//! Produces the data.json file for the frontend.
use std::{
    collections::{BTreeMap, BTreeSet, HashMap, HashSet},
    path::Path,
};

use anyhow::Context as _;
use serde::{ser::SerializeTuple, Deserialize, Serialize};

use crate::{
    extract, genre_top_artists, links, process,
    types::{GenreMixes, GenreName, PageDataId, PageName},
};

#[derive(Debug, Serialize)]
struct FrontendData {
    wikipedia_domain: String,
    wikipedia_db_name: String,
    dump_date: String,
    nodes: Vec<NodeData>,
    edges: BTreeSet<EdgeData>,
    max_degree: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct NodeData {
    #[serde(skip_serializing_if = "Option::is_none")]
    page_title: Option<String>,
    label: GenreName,
}

#[derive(Debug, Serialize, Deserialize)]
struct GenreFileData {
    description: Option<String>,
    last_revision_date: jiff::Timestamp,
    #[serde(skip_serializing_if = "Option::is_none")]
    mixes: Option<GenreMixes>,
    top_artists: Vec<PageName>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ArtistFileData {
    name: String,
    description: Option<String>,
    last_revision_date: jiff::Timestamp,
    genres: Vec<PageDataId>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(transparent)]
/// Maps link targets to page IDs.
struct LinksToPageIds(BTreeMap<String, PageDataId>);

#[derive(Debug, Serialize, Deserialize, Hash, PartialEq, Eq, PartialOrd, Ord)]
enum EdgeType {
    Derivative,
    Subgenre,
    FusionGenre,
}
#[derive(Debug, Hash, PartialEq, Eq, PartialOrd, Ord)]
struct EdgeData {
    source: PageDataId,
    target: PageDataId,
    ty: EdgeType,
}
impl Serialize for EdgeData {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let mut tup = serializer.serialize_tuple(3)?;
        tup.serialize_element(&self.source)?;
        tup.serialize_element(&self.target)?;
        tup.serialize_element(&match self.ty {
            EdgeType::Derivative => 0,
            EdgeType::Subgenre => 1,
            EdgeType::FusionGenre => 2,
        })?;
        tup.end()
    }
}

/// Given processed genres, produce a graph and save it to `data.json` to be rendered by the website.
#[allow(clippy::too_many_arguments)]
pub fn produce(
    start: std::time::Instant,
    dump_meta: &extract::DumpMeta,
    mixes_path: &Path,
    output_path: &Path,
    links_to_articles: &links::LinksToArticles,
    processed_genres: &process::ProcessedGenres,
    processed_artists: &process::ProcessedArtists,
    genre_top_artists: &genre_top_artists::GenreTopArtists,
    artist_genres: &genre_top_artists::ArtistGenres,
) -> anyhow::Result<()> {
    println!(
        "{:.2}s: producing output data",
        start.elapsed().as_secs_f32()
    );

    let mut graph = FrontendData {
        wikipedia_domain: dump_meta.wikipedia_domain.clone(),
        wikipedia_db_name: dump_meta.wikipedia_db_name.clone(),
        dump_date: dump_meta.dump_date.to_string(),
        nodes: vec![],
        edges: BTreeSet::new(),
        max_degree: 0,
    };

    let mut node_order = processed_genres.0.keys().cloned().collect::<Vec<_>>();
    node_order.sort();

    let mut page_to_id = HashMap::new();

    let mut artists_to_copy = HashSet::new();

    let genres_path = output_path.join("genres");
    std::fs::create_dir_all(&genres_path)?;

    // First pass: create nodes
    for page in &node_order {
        let processed_genre = &processed_genres.0[page];
        let id = PageDataId(graph.nodes.len());

        let mixes = std::fs::read_to_string(mixes_path.join(PageName::sanitize(page)))
            .ok()
            .map(|f| GenreMixes::parse(&f));

        let page_title = page.to_string();

        let node = NodeData {
            page_title: (processed_genre.name.0 != page_title).then_some(page_title),
            label: processed_genre.name.clone(),
        };

        graph.nodes.push(node);
        page_to_id.insert(page.clone(), id);
        let page_without_heading = page.with_opt_heading(None);
        // Add fallback page ID for pages where the main music box is under a heading
        page_to_id.entry(page_without_heading).or_insert(id);

        let top_artists = {
            let top_artist_pages: Vec<PageName> = genre_top_artists
                .get(page)
                .map(|artists| {
                    artists
                        .iter()
                        .map(|(artist, _)| artist.clone())
                        .take(10)
                        .collect()
                })
                .unwrap_or_default();

            let mut top_artists = vec![];
            for artist_page in top_artist_pages {
                artists_to_copy.insert(artist_page.clone());
                top_artists.push(artist_page);
            }
            top_artists
        };

        std::fs::write(
            genres_path.join(format!("{}.json", PageName::sanitize(page))),
            serde_json::to_string_pretty(&GenreFileData {
                description: processed_genre.wikitext_description.clone(),
                last_revision_date: processed_genre.last_revision_date,
                mixes,
                top_artists,
            })?,
        )?;
    }

    // Second pass: create edges
    for page in &node_order {
        let processed_genre = &processed_genres.0[page];
        let genre_id = *page_to_id.get(page).with_context(|| {
            format!(
                "{}: Missing page ID for genre `{page}`",
                processed_genre.page
            )
        })?;

        fn get_id_for_page(
            links_to_articles: &links::LinksToArticles,
            processed_genres: &process::ProcessedGenres,
            page_to_id: &HashMap<PageName, PageDataId>,
            source_page: &process::ProcessedGenre,
            ty: &str,
            link: &str,
        ) -> anyhow::Result<Option<PageDataId>> {
            // Not all links correspond to a genre, so we return an `Option`
            let Some(page) = links_to_articles.map(link) else {
                return Ok(None);
            };
            if !processed_genres.0.contains_key(&page) {
                // This isn't a genre, so we don't need to get its ID
                return Ok(None);
            }
            Ok(Some(page_to_id.get(&page).copied().with_context(|| {
                format!("{}: Missing page ID for {ty} `{link}`", source_page.page)
            })?))
        }

        for stylistic_origin in &processed_genre.stylistic_origins {
            if let Some(source_id) = get_id_for_page(
                links_to_articles,
                processed_genres,
                &page_to_id,
                processed_genre,
                "stylistic origin",
                stylistic_origin,
            )? {
                if source_id == genre_id {
                    continue;
                }

                graph.edges.insert(EdgeData {
                    source: source_id,
                    target: genre_id,
                    ty: EdgeType::Derivative,
                });
            }
        }
        for derivative in &processed_genre.derivatives {
            if let Some(target_id) = get_id_for_page(
                links_to_articles,
                processed_genres,
                &page_to_id,
                processed_genre,
                "derivative",
                derivative,
            )? {
                if target_id == genre_id {
                    continue;
                }

                graph.edges.insert(EdgeData {
                    source: genre_id,
                    target: target_id,
                    ty: EdgeType::Derivative,
                });
            }
        }
        for subgenre in &processed_genre.subgenres {
            if let Some(target_id) = get_id_for_page(
                links_to_articles,
                processed_genres,
                &page_to_id,
                processed_genre,
                "subgenre",
                subgenre,
            )? {
                if target_id == genre_id {
                    continue;
                }

                graph.edges.insert(EdgeData {
                    source: genre_id,
                    target: target_id,
                    ty: EdgeType::Subgenre,
                });
            }
        }
        for fusion_genre in &processed_genre.fusion_genres {
            if let Some(target_id) = get_id_for_page(
                links_to_articles,
                processed_genres,
                &page_to_id,
                processed_genre,
                "fusion genre",
                fusion_genre,
            )? {
                if target_id == genre_id {
                    continue;
                }

                graph.edges.insert(EdgeData {
                    source: genre_id,
                    target: target_id,
                    ty: EdgeType::FusionGenre,
                });
            }
        }
        // If this genre comes from a heading of another page, attempt to add the parent page
        // as a subgenre relationship, as long as it's not the same page (this can happen in
        // a few strange cases, like "Satirical music#History").
        if page.heading.is_some() {
            if let Some(parent_page) = page_to_id
                .get(&page.with_opt_heading(None))
                .copied()
                .filter(|pp| *pp != genre_id)
            {
                graph.edges.insert(EdgeData {
                    source: parent_page,
                    target: genre_id,
                    ty: EdgeType::Subgenre,
                });
            }
        }
    }

    // Third pass (over edges): build node->edges sets for calculating max degree
    let mut node_to_edges = HashMap::new();
    for (i, edge) in graph.edges.iter().enumerate() {
        node_to_edges
            .entry(edge.source)
            .or_insert_with(BTreeSet::new)
            .insert(i);
        node_to_edges
            .entry(edge.target)
            .or_insert_with(BTreeSet::new)
            .insert(i);
    }

    // Fourth pass: calculate max degree
    graph.max_degree = node_to_edges
        .values()
        .map(|edges| edges.len())
        .max()
        .unwrap_or(0);

    // Fifth pass (over links_to_articles): update links_to_page_ids
    std::fs::write(
        output_path.join("links_to_page_ids.json"),
        serde_json::to_string_pretty(&LinksToPageIds(BTreeMap::from_iter(
            links_to_articles
                .0
                .iter()
                .filter_map(|(link, page)| page_to_id.get(page).map(|id| (link.clone(), *id))),
        )))?,
    )?;

    // Copy artist data
    let artists_path = output_path.join("artists");
    std::fs::create_dir_all(&artists_path)?;
    for artist_page in &artists_to_copy {
        if let Some(artist) = processed_artists.0.get(artist_page) {
            let data = ArtistFileData {
                name: artist.name.0.clone(),
                last_revision_date: artist.last_revision_date,
                description: artist.wikitext_description.clone(),
                genres: artist_genres
                    .get(artist_page)
                    .map(|gs| gs.iter().flat_map(|g| page_to_id.get(g).copied()).collect())
                    .unwrap_or_default(),
            };
            std::fs::write(
                artists_path.join(format!("{}.json", PageName::sanitize(artist_page))),
                serde_json::to_string_pretty(&data)?,
            )?;
        }
    }
    println!(
        "{:.2}s: saved {} artists",
        start.elapsed().as_secs_f32(),
        artists_to_copy.len()
    );

    let data_path = output_path.join("data.json");
    std::fs::write(data_path, serde_json::to_string_pretty(&graph)?)?;
    println!("{:.2}s: saved data.json", start.elapsed().as_secs_f32());

    Ok(())
}
