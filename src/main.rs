use anyhow::Context;
use quick_xml::events::Event;
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeSet, HashMap},
    path::{Path, PathBuf},
};

use parse_wiki_text_2 as pwt;

mod data_patches;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[serde(transparent)]
/// A newtype for a Wikipedia page name.
pub struct PageName(pub String);
impl std::fmt::Display for PageName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "page:{}", self.0)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[serde(transparent)]
/// A newtype for a genre name.
pub struct GenreName(pub String);
impl std::fmt::Display for GenreName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "genre:{}", self.0)
    }
}

#[derive(Debug, Deserialize)]
struct Config {
    wikipedia_dump_path: PathBuf,
}
fn main() -> anyhow::Result<()> {
    let config: Config = {
        let config_str =
            std::fs::read_to_string("config.toml").context("Failed to read config.toml")?;
        toml::from_str(&config_str).context("Failed to parse config.toml")?
    };

    let dump_date = parse_wiki_dump_date(
        &config
            .wikipedia_dump_path
            .file_stem()
            .unwrap()
            .to_string_lossy(),
    )
    .with_context(|| {
        format!(
            "Failed to parse Wikipedia dump date from {:?}",
            config.wikipedia_dump_path
        )
    })?;

    let output_path = Path::new("output").join(dump_date.to_string());
    let genres_path = output_path.join("genres");
    let redirects_path = output_path.join("all_redirects.toml");
    let links_to_articles_path = output_path.join("links_to_articles.toml");
    let processed_genres_path = output_path.join("processed");

    let website_path = Path::new("website");
    let website_public_path = website_path.join("public");
    let data_path = website_public_path.join("data.json");

    let start = std::time::Instant::now();

    let (genres, all_redirects) =
        extract_genre_and_all_redirects(&config, start, &genres_path, &redirects_path)?;

    let links_to_articles =
        resolve_links_to_articles(start, &links_to_articles_path, &genres, all_redirects)?;

    let mut processed_genres =
        process_genres(start, &genres, &links_to_articles, &processed_genres_path)?;

    remove_ignored_pages_and_detect_duplicates(&mut processed_genres);

    produce_data_json(start, dump_date, &data_path, &processed_genres)?;

    Ok(())
}

/// Parse a Wikipedia dump filename to extract the date as a Jiff civil date.
///
/// Takes a filename like "enwiki-20250123-pages-articles-multistream" and returns
/// the Jiff civil date for (2025, 01, 23).
/// Returns None if the filename doesn't match the expected format.
fn parse_wiki_dump_date(filename: &str) -> Option<jiff::civil::Date> {
    // Extract just the date portion (20250123)
    let date_str = filename.strip_prefix("enwiki-")?.split('-').next()?;

    if date_str.len() != 8 {
        return None;
    }

    // Parse year, month, day
    let year = date_str[0..4].parse().ok()?;
    let month = date_str[4..6].parse().ok()?;
    let day = date_str[6..8].parse().ok()?;

    Some(jiff::civil::date(year, month, day))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_wiki_dump_date() {
        assert_eq!(
            parse_wiki_dump_date("enwiki-20250123-pages-articles-multistream"),
            Some((2025, 1, 23))
        );
        assert_eq!(parse_wiki_dump_date("invalid"), None);
    }
}

#[derive(Clone, Default)]
struct GenrePages(pub HashMap<PageName, PathBuf>);
impl GenrePages {
    pub fn all(&self) -> impl Iterator<Item = &PageName> {
        self.0.keys()
    }
    pub fn iter(&self) -> impl Iterator<Item = (&PageName, &PathBuf)> {
        self.0.iter()
    }
}

enum AllRedirects {
    InMemory(HashMap<PageName, PageName>),
    LazyLoad(PathBuf, std::time::Instant),
}
impl TryFrom<AllRedirects> for HashMap<PageName, PageName> {
    type Error = anyhow::Error;
    fn try_from(value: AllRedirects) -> Result<Self, Self::Error> {
        match value {
            AllRedirects::InMemory(value) => Ok(value),
            AllRedirects::LazyLoad(path, start) => {
                let value = toml::from_str(&std::fs::read_to_string(path)?)?;
                println!(
                    "{:.2}s: loaded all redirects",
                    start.elapsed().as_secs_f32()
                );
                Ok(value)
            }
        }
    }
}

/// Given a Wikipedia dump, extract genres and all redirects.
///
/// We extract all redirects as we may need to resolve redirects to redirects.
fn extract_genre_and_all_redirects(
    config: &Config,
    start: std::time::Instant,
    genres_path: &Path,
    redirects_path: &Path,
) -> anyhow::Result<(GenrePages, AllRedirects)> {
    let mut genre_pages = HashMap::default();
    let mut all_redirects = HashMap::<PageName, PageName>::default();

    // Already exists, just load from file
    if genres_path.is_dir() && redirects_path.is_file() {
        for entry in std::fs::read_dir(genres_path)? {
            let path = entry?.path();
            let Some(file_stem) = path.file_stem() else {
                continue;
            };
            genre_pages.insert(unsanitize_page_name(&file_stem.to_string_lossy()), path);
        }
        println!(
            "{:.2}s: loaded all {} genres",
            start.elapsed().as_secs_f32(),
            genre_pages.len()
        );

        return Ok((
            GenrePages(genre_pages),
            AllRedirects::LazyLoad(redirects_path.to_owned(), start),
        ));
    }

    println!("Genres directory or redirects file does not exist, extracting from Wikipedia dump");

    let now = std::time::Instant::now();
    let mut count = 0;
    std::fs::create_dir_all(genres_path).context("Failed to create genres directory")?;

    // This could be made much faster by loading the file into memory and using the index to attack
    // the streams in parallel, but this will only run once every month, so it's not worth optimising.
    let file = std::fs::File::open(&config.wikipedia_dump_path)
        .context("Failed to open Wikipedia dump file")?;
    let decoder = bzip2::bufread::MultiBzDecoder::new(std::io::BufReader::new(file));
    let reader = std::io::BufReader::new(decoder);
    let mut reader = quick_xml::reader::Reader::from_reader(reader);
    reader.config_mut().trim_text(true);

    let mut buf = vec![];
    let mut title = String::new();
    let mut recording_title = false;
    let mut text = String::new();
    let mut recording_text = false;
    let mut redirect = None;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Eof) => break,
            Ok(Event::Start(e)) => {
                let name = e.name().0;
                if name == b"title" {
                    title.clear();
                    recording_title = true;
                } else if name == b"text" {
                    text.clear();
                    recording_text = true;
                }
            }
            Ok(Event::Text(e)) => {
                if recording_title {
                    title.push_str(&e.unescape().unwrap());
                } else if recording_text {
                    text.push_str(&e.unescape().unwrap());
                }
            }
            Ok(Event::Empty(e)) => {
                if e.name().0 == b"redirect" {
                    redirect = e
                        .attributes()
                        .filter_map(|r| r.ok())
                        .find(|attr| attr.key.0 == b"title")
                        .map(|attr| String::from_utf8_lossy(&attr.value).to_string());
                }
            }
            Ok(Event::End(e)) => {
                if e.name().0 == b"title" {
                    recording_title = false;
                } else if e.name().0 == b"text" {
                    recording_text = false;
                } else if e.name().0 == b"page" {
                    let page = PageName(title.clone());
                    if let Some(redirect) = redirect {
                        all_redirects.insert(page, PageName(redirect));

                        count += 1;
                        if count % 1000 == 0 {
                            println!("{:.2}s: {count} redirects", start.elapsed().as_secs_f32());
                        }
                    } else if text.contains("nfobox music genre") {
                        if title.contains(":") {
                            continue;
                        }

                        let path =
                            genres_path.join(format!("{}.wikitext", sanitize_page_name(&page)));
                        std::fs::write(&path, &text)
                            .with_context(|| format!("Failed to write genre page {page}"))?;

                        genre_pages.insert(page.clone(), path);
                        println!("{:.2}s: {page}", start.elapsed().as_secs_f32());
                    }

                    redirect = None;
                }
            }
            _ => {}
        }
        buf.clear();
    }

    std::fs::write(
        redirects_path,
        toml::to_string_pretty(&all_redirects)?.as_bytes(),
    )
    .context("Failed to write redirects")?;
    println!("Extracted genres and redirects in {:?}", now.elapsed());

    Ok((
        GenrePages(genre_pages),
        AllRedirects::InMemory(all_redirects),
    ))
}

pub struct LinksToArticles(pub HashMap<String, PageName>);
/// Construct a map of links (lower-case page names and redirects) to genres.
///
/// This will loop over all redirects and find redirects to already-resolved genres, adding them to the map.
/// It will continue to do this until no new links are found.
fn resolve_links_to_articles(
    start: std::time::Instant,
    links_to_articles_path: &Path,
    genres: &GenrePages,
    all_redirects: AllRedirects,
) -> anyhow::Result<LinksToArticles> {
    if links_to_articles_path.is_file() {
        let links_to_articles: HashMap<String, PageName> =
            toml::from_str(&std::fs::read_to_string(links_to_articles_path)?)?;
        println!(
            "{:.2}s: loaded all {} links to articles",
            start.elapsed().as_secs_f32(),
            links_to_articles.len()
        );
        return Ok(LinksToArticles(links_to_articles));
    }

    let all_redirects: HashMap<_, _> = all_redirects.try_into()?;

    let now = std::time::Instant::now();

    let mut links_to_articles: HashMap<String, PageName> = genres
        .all()
        .map(|s| (s.0.to_lowercase(), s.clone()))
        .collect();

    let mut round = 1;
    loop {
        let mut added = false;
        for (page, redirect) in &all_redirects {
            let page = page.0.to_lowercase();
            let redirect = redirect.0.to_lowercase();

            if let Some(target) = links_to_articles.get(&redirect) {
                let newly_added = links_to_articles.insert(page, target.clone()).is_none();
                added |= newly_added;
            }
        }
        println!(
            "{:.2}s: round {round}, {} links",
            start.elapsed().as_secs_f32(),
            links_to_articles.len()
        );
        if !added {
            break;
        }
        round += 1;
    }
    println!(
        "{:.2}s: {} links fully resolved",
        start.elapsed().as_secs_f32(),
        links_to_articles.len()
    );

    // Save links to articles to file
    std::fs::write(
        links_to_articles_path,
        toml::to_string_pretty(&links_to_articles)?.as_bytes(),
    )
    .context("Failed to write links to articles")?;
    println!("Saved links to articles in {:?}", now.elapsed());

    Ok(LinksToArticles(links_to_articles))
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct ProcessedGenre {
    name: GenreName,
    stylistic_origins: Vec<PageName>,
    derivatives: Vec<PageName>,
    subgenres: Vec<PageName>,
    fusion_genres: Vec<PageName>,
}
struct ProcessedGenres(pub HashMap<PageName, ProcessedGenre>);
/// Given raw genre wikitext, extract the relevant information and save it to file.
fn process_genres(
    start: std::time::Instant,
    genres: &GenrePages,
    links_to_articles: &LinksToArticles,
    processed_genres_path: &Path,
) -> anyhow::Result<ProcessedGenres> {
    if processed_genres_path.is_dir() {
        let mut processed_genres = HashMap::default();
        for entry in std::fs::read_dir(processed_genres_path)? {
            let path = entry?.path();
            let Some(file_stem) = path.file_stem() else {
                continue;
            };
            processed_genres.insert(
                unsanitize_page_name(&file_stem.to_string_lossy()),
                toml::from_str(&std::fs::read_to_string(path)?)?,
            );
        }
        return Ok(ProcessedGenres(processed_genres));
    }

    println!("Processed genres do not exist, generating from raw genres");

    std::fs::create_dir_all(processed_genres_path)?;

    let pwt_configuration = pwt_configuration();
    let all_patches = data_patches::all();

    let mut processed_genres = HashMap::default();
    let mut genre_count = 0usize;
    let mut stylistic_origin_count = 0usize;
    let mut derivative_count = 0usize;

    for (page, path) in genres.iter() {
        let wikitext = std::fs::read_to_string(path)?;
        let wikitext = pwt_configuration
            .parse_with_timeout(&wikitext, std::time::Duration::from_secs(1))
            .unwrap_or_else(|e| panic!("failed to parse wikitext ({page}): {e:?}"));
        for node in &wikitext.nodes {
            if let pwt::Node::Template {
                name, parameters, ..
            } = node
            {
                if nodes_inner_text(name, &InnerTextConfig::default()).to_lowercase()
                    != "infobox music genre"
                {
                    continue;
                }

                let parameters = parameters_to_map(parameters);

                // Extract name from parameters
                let mut name = GenreName(match parameters.get("name") {
                    None | Some([]) => page.0.clone(),
                    Some(nodes) => {
                        let name = nodes_inner_text(
                            nodes,
                            &InnerTextConfig {
                                // Some genre headings have a `<br>` tag, followed by another name.
                                // We only want the first name, so stop after the first `<br>`.
                                stop_after_br: true,
                            },
                        );
                        if name.is_empty() {
                            panic!("Failed to extract name from {page}, params: {parameters:?}");
                        }
                        name
                    }
                });
                if let Some((_timestamp, new_name)) = all_patches.get(page) {
                    // TODO: Check article date before applying
                    name = new_name.clone();
                }

                let map_links_to_articles = |links: Vec<String>| -> Vec<PageName> {
                    links
                        .into_iter()
                        .filter_map(|link| {
                            links_to_articles
                                .0
                                .get(&link.to_lowercase())
                                .map(|s| s.to_owned())
                        })
                        .collect()
                };

                let stylistic_origins = parameters
                    .get("stylistic_origins")
                    .map(|ns| get_links_from_nodes(ns))
                    .map(map_links_to_articles)
                    .unwrap_or_default();
                let derivatives = parameters
                    .get("derivatives")
                    .map(|ns| get_links_from_nodes(ns))
                    .map(map_links_to_articles)
                    .unwrap_or_default();
                let subgenres = parameters
                    .get("subgenres")
                    .map(|ns| get_links_from_nodes(ns))
                    .map(map_links_to_articles)
                    .unwrap_or_default();
                let fusion_genres = parameters
                    .get("fusiongenres")
                    .map(|ns| get_links_from_nodes(ns))
                    .map(map_links_to_articles)
                    .unwrap_or_default();

                genre_count += 1;
                stylistic_origin_count += stylistic_origins.len();
                derivative_count += derivatives.len();

                let processed_genre = ProcessedGenre {
                    name: name.clone(),
                    stylistic_origins,
                    derivatives,
                    subgenres,
                    fusion_genres,
                };
                processed_genres.insert(page.clone(), processed_genre.clone());

                std::fs::write(
                    processed_genres_path.join(format!("{}.toml", sanitize_page_name(page))),
                    toml::to_string_pretty(&processed_genre)?,
                )?;
            }
        }
    }

    println!(
        "{:.2}s: Processed all {genre_count} genres, {stylistic_origin_count} stylistic origins, {derivative_count} derivatives",
        start.elapsed().as_secs_f32()
    );

    Ok(ProcessedGenres(processed_genres))
}

fn remove_ignored_pages_and_detect_duplicates(processed_genres: &mut ProcessedGenres) {
    for page in data_patches::pages_to_ignore() {
        processed_genres.0.remove(&page);
    }

    let mut previously_encountered_genres = HashMap::new();
    for (page, processed_genre) in processed_genres.0.iter() {
        if let Some(old_page) =
            previously_encountered_genres.insert(processed_genre.name.clone(), page.clone())
        {
            panic!(
                "Duplicate genre `{}` on pages `{old_page}` and `{page}`",
                processed_genre.name
            );
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct Graph {
    dump_date: String,
    nodes: Vec<NodeData>,
    links: BTreeSet<LinkData>,
    max_degree: usize,
}
#[derive(Debug, Serialize, Deserialize)]
struct NodeData {
    id: PageName,
    label: GenreName,
    degree: usize,
}
#[derive(Debug, Serialize, Deserialize, Hash, PartialEq, Eq, PartialOrd, Ord)]
enum LinkType {
    Derivative,
    Subgenre,
    FusionGenre,
}
#[derive(Debug, Serialize, Deserialize, Hash, PartialEq, Eq, PartialOrd, Ord)]
struct LinkData {
    source: PageName,
    target: PageName,
    ty: LinkType,
}

/// Given processed genres, produce a graph and save it to file to be rendered by the website.
fn produce_data_json(
    start: std::time::Instant,
    dump_date: jiff::civil::Date,
    data_path: &Path,
    processed_genres: &ProcessedGenres,
) -> anyhow::Result<()> {
    let mut graph = Graph {
        dump_date: dump_date.to_string(),
        nodes: vec![],
        links: BTreeSet::new(),
        max_degree: 0,
    };

    let mut node_order = processed_genres.0.keys().cloned().collect::<Vec<_>>();
    node_order.sort();

    let mut id_to_index = HashMap::new();

    for genre in node_order {
        let processed_genre = &processed_genres.0[&genre];
        let node = NodeData {
            id: genre.clone(),
            label: processed_genre.name.clone(),
            degree: 0,
        };

        graph.nodes.push(node);
        id_to_index.insert(genre.clone(), graph.nodes.len() - 1);

        for stylistic_origin in &processed_genre.stylistic_origins {
            graph.links.insert(LinkData {
                source: stylistic_origin.clone(),
                target: genre.clone(),
                ty: LinkType::Derivative,
            });
        }
        for derivative in &processed_genre.derivatives {
            graph.links.insert(LinkData {
                source: genre.clone(),
                target: derivative.clone(),
                ty: LinkType::Derivative,
            });
        }
        for subgenre in &processed_genre.subgenres {
            graph.links.insert(LinkData {
                source: genre.clone(),
                target: subgenre.clone(),
                ty: LinkType::Subgenre,
            });
        }
        for fusion_genre in &processed_genre.fusion_genres {
            graph.links.insert(LinkData {
                source: genre.clone(),
                target: fusion_genre.clone(),
                ty: LinkType::FusionGenre,
            });
        }
    }

    for link in &graph.links {
        graph.nodes[id_to_index[&link.source]].degree += 1;
        graph.nodes[id_to_index[&link.target]].degree += 1;
    }

    graph.max_degree = graph.nodes.iter().map(|n| n.degree).max().unwrap_or(0);

    std::fs::write(data_path, serde_json::to_string_pretty(&graph)?)?;
    println!("{:.2}s: Saved data.json", start.elapsed().as_secs_f32());

    Ok(())
}

fn get_links_from_nodes(nodes: &[pwt::Node]) -> Vec<String> {
    let mut output = vec![];
    nodes_recurse(nodes, &mut output, |output, node| {
        if let pwt::Node::Link { target, .. } = node {
            output.push(target.to_string());
            false
        } else {
            true
        }
    });
    output
}

fn nodes_recurse<R>(
    nodes: &[pwt::Node],
    result: &mut R,
    operator: impl Fn(&mut R, &pwt::Node) -> bool + Copy,
) {
    for node in nodes {
        node_recurse(node, result, operator);
    }
}

fn node_recurse<R>(
    node: &pwt::Node,
    result: &mut R,
    operator: impl Fn(&mut R, &pwt::Node) -> bool + Copy,
) {
    use pwt::Node;
    if !operator(result, node) {
        return;
    }
    match node {
        Node::Category { ordinal, .. } => nodes_recurse(ordinal, result, operator),
        Node::DefinitionList { items, .. } => {
            for item in items {
                nodes_recurse(&item.nodes, result, operator);
            }
        }
        Node::ExternalLink { nodes, .. } => nodes_recurse(nodes, result, operator),
        Node::Heading { nodes, .. } => nodes_recurse(nodes, result, operator),
        Node::Link { text, .. } => nodes_recurse(text, result, operator),
        Node::OrderedList { items, .. } | Node::UnorderedList { items, .. } => {
            for item in items {
                nodes_recurse(&item.nodes, result, operator);
            }
        }
        Node::Parameter { default, name, .. } => {
            if let Some(default) = &default {
                nodes_recurse(default, result, operator);
            }
            nodes_recurse(name, result, operator);
        }
        Node::Preformatted { nodes, .. } => nodes_recurse(nodes, result, operator),
        Node::Table {
            attributes,
            captions,
            rows,
            ..
        } => {
            nodes_recurse(attributes, result, operator);
            for caption in captions {
                if let Some(attributes) = &caption.attributes {
                    nodes_recurse(attributes, result, operator);
                }
                nodes_recurse(&caption.content, result, operator);
            }
            for row in rows {
                nodes_recurse(&row.attributes, result, operator);
                for cell in &row.cells {
                    if let Some(attributes) = &cell.attributes {
                        nodes_recurse(attributes, result, operator);
                    }
                    nodes_recurse(&cell.content, result, operator);
                }
            }
        }
        Node::Tag { nodes, .. } => {
            nodes_recurse(nodes, result, operator);
        }
        Node::Template {
            name, parameters, ..
        } => {
            nodes_recurse(name, result, operator);
            for parameter in parameters {
                if let Some(name) = &parameter.name {
                    nodes_recurse(name, result, operator);
                }
                nodes_recurse(&parameter.value, result, operator);
            }
        }
        _ => {}
    }
}

fn parameters_to_map<'a>(
    parameters: &'a [pwt::Parameter<'a>],
) -> HashMap<String, &'a [pwt::Node<'a>]> {
    parameters
        .iter()
        .filter_map(|p| {
            Some((
                nodes_inner_text(p.name.as_deref()?, &InnerTextConfig::default()),
                p.value.as_slice(),
            ))
        })
        .collect()
}

#[derive(Default)]
struct InnerTextConfig {
    /// Whether to stop after a `<br>` tag.
    stop_after_br: bool,
}

/// Joins nodes together without any space between them and trims the result, which is not always the correct behaviour
fn nodes_inner_text(nodes: &[pwt::Node], config: &InnerTextConfig) -> String {
    let mut result = String::new();
    for node in nodes {
        if config.stop_after_br && matches!(node, pwt::Node::StartTag { name, .. } if name == "br")
        {
            break;
        }
        result.push_str(&node_inner_text(node, config));
    }
    result.trim().to_string()
}

/// Just gets the inner text without any formatting, which is not always the correct behaviour
///
/// This function is allocation-heavy; there's definitely room for optimisation here, but it's
/// not a huge issue right now
fn node_inner_text(node: &pwt::Node, config: &InnerTextConfig) -> String {
    use pwt::Node;
    match node {
        Node::CharacterEntity { character, .. } => character.to_string(),
        // Node::DefinitionList { end, items, start } => nodes_inner_text(items, config),
        Node::Heading { nodes, .. } => nodes_inner_text(nodes, config),
        Node::Image { text, .. } => nodes_inner_text(text, config),
        Node::Link { text, .. } => nodes_inner_text(text, config),
        // Node::OrderedList { end, items, start } => nodes_inner_text(items, config),
        Node::Preformatted { nodes, .. } => nodes_inner_text(nodes, config),
        Node::Text { value, .. } => value.to_string(),
        // Node::UnorderedList { end, items, start } => nodes_inner_text(items, config),
        Node::Template {
            name, parameters, ..
        } => {
            let name = nodes_inner_text(name, config).to_ascii_lowercase();

            if name == "lang" {
                // hack: extract the text from the other-language template
                // the parameter is `|text=`, or the second paramter, so scan for both
                parameters
                    .iter()
                    .find(|p| {
                        p.name
                            .as_ref()
                            .is_some_and(|n| nodes_inner_text(n, config) == "text")
                    })
                    .or_else(|| parameters.iter().filter(|p| p.name.is_none()).nth(1))
                    .map(|p| nodes_inner_text(&p.value, config))
                    .unwrap_or_default()
            } else if name == "transliteration" || name == "tlit" || name == "transl" {
                // text is either the second or the third positional argument;
                // in the case of the latter, the second argument is the transliteration scheme,
                // so we want to select for the third first before the second

                let positional_args = parameters
                    .iter()
                    .filter(|p| p.name.is_none())
                    .collect::<Vec<_>>();
                if positional_args.len() >= 3 {
                    nodes_inner_text(&positional_args[2].value, config)
                } else {
                    nodes_inner_text(&positional_args[1].value, config)
                }
            } else {
                "".to_string()
            }
        }
        _ => "".to_string(),
    }
}

/// Makes a Wikipedia page name safe to store on disk.
fn sanitize_page_name(title: &PageName) -> String {
    title.0.replace("/", "#")
}

/// Reverses [`sanitize_page_name`].
fn unsanitize_page_name(title: &str) -> PageName {
    PageName(title.replace("#", "/"))
}

pub fn pwt_configuration() -> pwt::Configuration {
    pwt::Configuration::new(&pwt::ConfigurationSource {
        category_namespaces: &["category"],
        extension_tags: &[
            "categorytree",
            "ce",
            "charinsert",
            "chem",
            "gallery",
            "graph",
            "hiero",
            "imagemap",
            "indicator",
            "inputbox",
            "langconvert",
            "mapframe",
            "maplink",
            "math",
            "nowiki",
            "poem",
            "pre",
            "ref",
            "references",
            "score",
            "section",
            "source",
            "syntaxhighlight",
            "templatedata",
            "templatestyles",
            "timeline",
        ],
        file_namespaces: &["file", "image"],
        link_trail: "abcdefghijklmnopqrstuvwxyz",
        magic_words: &[
            "disambig",
            "expected_unconnected_page",
            "expectunusedcategory",
            "forcetoc",
            "hiddencat",
            "index",
            "newsectionlink",
            "nocc",
            "nocontentconvert",
            "noeditsection",
            "nogallery",
            "noglobal",
            "noindex",
            "nonewsectionlink",
            "notc",
            "notitleconvert",
            "notoc",
            "staticredirect",
            "toc",
        ],
        protocols: &[
            "//",
            "bitcoin:",
            "ftp://",
            "ftps://",
            "geo:",
            "git://",
            "gopher://",
            "http://",
            "https://",
            "irc://",
            "ircs://",
            "magnet:",
            "mailto:",
            "mms://",
            "news:",
            "nntp://",
            "redis://",
            "sftp://",
            "sip:",
            "sips:",
            "sms:",
            "ssh://",
            "svn://",
            "tel:",
            "telnet://",
            "urn:",
            "worldwind://",
            "xmpp:",
        ],
        redirect_magic_words: &["redirect"],
    })
}
