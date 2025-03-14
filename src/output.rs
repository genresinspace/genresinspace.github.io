//! Produces the data.json file for the frontend.
use std::{
    collections::{BTreeMap, BTreeSet, HashMap},
    path::Path,
};

use anyhow::Context as _;
use serde::{Deserialize, Serialize};

use crate::{
    extract, links, process,
    types::{GenreName, PageDataId, PageName},
};

#[derive(Debug, Serialize, Deserialize)]
struct FrontendData {
    wikipedia_domain: String,
    wikipedia_db_name: String,
    dump_date: String,
    nodes: Vec<NodeData>,
    edges: BTreeSet<EdgeData>,
    /// This is a separate field as `LinksToArticles` has already resolved
    /// redirects, which we wouldn't know about on the client
    links_to_page_ids: BTreeMap<String, PageDataId>,
    max_degree: usize,
}
#[derive(Debug, Serialize, Deserialize)]
struct NodeData {
    id: PageDataId,
    page_title: PageName,
    wikitext_description: Option<String>,
    label: GenreName,
    last_revision_date: jiff::Timestamp,
    #[serde(skip_serializing_if = "Option::is_none")]
    mixes: Option<GenreMixes>,
    edges: BTreeSet<usize>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
enum GenreMix {
    Playlist {
        playlist: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        note: Option<String>,
    },
    Video {
        video: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        note: Option<String>,
    },
}
#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
enum GenreMixes {
    Help { help_reason: String },
    Mixes(Vec<GenreMix>),
}
impl GenreMixes {
    pub fn parse(input: &str) -> Self {
        let input = input.trim();

        if let Some(help_reason) = input.strip_prefix("help:") {
            return GenreMixes::Help {
                help_reason: help_reason.trim().to_string(),
            };
        }

        let mut mixes = vec![];
        for line in input.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            let (url, note) = if let Some((url, comment)) = line.split_once('#') {
                (url.trim(), Some(comment.trim().to_string()))
            } else {
                (line, None)
            };

            if let Some(playlist_id) = extract_playlist_id(url) {
                mixes.push(GenreMix::Playlist {
                    playlist: playlist_id,
                    note,
                });
            } else if let Some(video_id) = extract_video_id(url) {
                mixes.push(GenreMix::Video {
                    video: video_id,
                    note,
                });
            }
        }

        fn extract_playlist_id(url: &str) -> Option<String> {
            url.find("list=").map(|list| {
                url[list + 5..]
                    .split(['&', '#'])
                    .next()
                    .unwrap()
                    .to_string()
            })
        }

        fn extract_video_id(url: &str) -> Option<String> {
            if let Some(v) = url.find("v=") {
                Some(url[v + 2..].split(['&', '#']).next().unwrap().to_string())
            } else if url.contains("youtu.be/") {
                url.split('/')
                    .last()
                    .map(|s| s.split(['&', '#']).next().unwrap().to_string())
            } else {
                None
            }
        }

        GenreMixes::Mixes(mixes)
    }
}
#[derive(Debug, Serialize, Deserialize, Hash, PartialEq, Eq, PartialOrd, Ord)]
enum EdgeType {
    Derivative,
    Subgenre,
    FusionGenre,
}
#[derive(Debug, Serialize, Deserialize, Hash, PartialEq, Eq, PartialOrd, Ord)]
struct EdgeData {
    source: PageDataId,
    target: PageDataId,
    ty: EdgeType,
}

/// Given processed genres, produce a graph and save it to `data.json` to be rendered by the website.
pub fn produce_data_json(
    start: std::time::Instant,
    dump_meta: &extract::DumpMeta,
    mixes_path: &Path,
    data_path: &Path,
    links_to_articles: &links::LinksToArticles,
    processed_genres: &process::ProcessedGenres,
) -> anyhow::Result<()> {
    let mut graph = FrontendData {
        wikipedia_domain: dump_meta.wikipedia_domain.clone(),
        wikipedia_db_name: dump_meta.wikipedia_db_name.clone(),
        dump_date: dump_meta.dump_date.to_string(),
        nodes: vec![],
        edges: BTreeSet::new(),
        links_to_page_ids: BTreeMap::new(),
        max_degree: 0,
    };

    let mut node_order = processed_genres.0.keys().cloned().collect::<Vec<_>>();
    node_order.sort();

    let mut page_to_id = HashMap::new();

    // First pass: create nodes
    for page in &node_order {
        let processed_genre = &processed_genres.0[page];
        let id = PageDataId(graph.nodes.len());

        let mixes = std::fs::read_to_string(mixes_path.join(PageName::sanitize(page)))
            .ok()
            .map(|f| GenreMixes::parse(&f));

        let node = NodeData {
            id,
            page_title: page.clone(),
            wikitext_description: processed_genre.wikitext_description.clone(),
            label: processed_genre.name.clone(),
            last_revision_date: processed_genre.last_revision_date,
            mixes,
            edges: BTreeSet::new(),
        };

        graph.nodes.push(node);
        page_to_id.insert(page.clone(), id);
        let page_without_heading = page.with_opt_heading(None);
        // Add fallback page ID for pages where the main music box is under a heading
        page_to_id.entry(page_without_heading).or_insert(id);
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
            page_to_id: &HashMap<PageName, PageDataId>,
            source_page: &process::ProcessedGenre,
            ty: &str,
            link: &str,
        ) -> anyhow::Result<Option<PageDataId>> {
            // Not all links correspond to a genre, so we return an `Option`
            let Some(page) = links_to_articles.map(link) else {
                return Ok(None);
            };
            Ok(Some(page_to_id.get(&page).copied().with_context(|| {
                format!("{}: Missing page ID for {ty} `{link}`", source_page.page)
            })?))
        }

        for stylistic_origin in &processed_genre.stylistic_origins {
            if let Some(source_id) = get_id_for_page(
                links_to_articles,
                &page_to_id,
                processed_genre,
                "stylistic origin",
                stylistic_origin,
            )? {
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
                &page_to_id,
                processed_genre,
                "derivative",
                derivative,
            )? {
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
                &page_to_id,
                processed_genre,
                "subgenre",
                subgenre,
            )? {
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
                &page_to_id,
                processed_genre,
                "fusion genre",
                fusion_genre,
            )? {
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

    // Third pass (over edges): update inbound/outbound sets
    for (i, edge) in graph.edges.iter().enumerate() {
        graph.nodes[edge.source.0].edges.insert(i);
        graph.nodes[edge.target.0].edges.insert(i);
    }

    // Fourth pass: calculate max degree
    graph.max_degree = graph.nodes.iter().map(|n| n.edges.len()).max().unwrap_or(0);

    // Fifth pass (over links_to_articles): update links_to_page_ids
    graph.links_to_page_ids.extend(
        links_to_articles
            .0
            .iter()
            .filter_map(|(link, page)| page_to_id.get(page).map(|id| (link.clone(), *id))),
    );

    std::fs::write(data_path, serde_json::to_string_pretty(&graph)?)?;
    println!("{:.2}s: Saved data.json", start.elapsed().as_secs_f32());

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_help() {
        assert_eq!(
            GenreMixes::parse("help: not ready"),
            GenreMixes::Help {
                help_reason: "not ready".to_string()
            }
        );
    }
    #[test]
    fn test_mixes() {
        assert_eq!(
            GenreMixes::parse(
                "https://www.youtube.com/playlist?list=PLMC9KNkIncKvYin_USF1qoJQnIyMAfRxl
                 https://www.youtube.com/playlist?list=PLH22-xSMERQrmeOAp7kJy-0BHfGJbl4Jg # A great mix
                 https://youtu.be/dQw4w9WgXcQ # You're on your own with finding a mix for this."
            ),
            GenreMixes::Mixes(vec![
                GenreMix::Playlist {
                    playlist: "PLMC9KNkIncKvYin_USF1qoJQnIyMAfRxl".to_string(),
                    note: None
                },
                GenreMix::Playlist {
                        playlist: "PLH22-xSMERQrmeOAp7kJy-0BHfGJbl4Jg".to_string(),
                    note: Some("A great mix".to_string())
                },
                GenreMix::Video {
                    video: "dQw4w9WgXcQ".to_string(),
                    note: Some("You're on your own with finding a mix for this.".to_string())
                }
            ])
        );
    }

    #[test]
    fn test_video_formats() {
        assert_eq!(
            GenreMixes::parse(
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ
                 https://youtu.be/dQw4w9WgXcQ"
            ),
            GenreMixes::Mixes(vec![
                GenreMix::Video {
                    video: "dQw4w9WgXcQ".to_string(),
                    note: None
                },
                GenreMix::Video {
                    video: "dQw4w9WgXcQ".to_string(),
                    note: None
                }
            ])
        );
    }
}
