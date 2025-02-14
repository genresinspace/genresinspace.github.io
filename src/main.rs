use anyhow::Context;
use jiff::ToSpan;
use quick_xml::events::Event;
use rayon::iter::{IntoParallelRefIterator, ParallelIterator};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeSet, HashMap, HashSet},
    io::{BufRead, Write as _},
    path::{Path, PathBuf},
    sync::LazyLock,
};

use parse_wiki_text_2 as pwt;

mod data_patches;
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
/// A newtype for a Wikipedia page name.
pub struct PageName {
    pub name: String,
    pub heading: Option<String>,
}
impl PageName {
    pub fn new(name: impl Into<String>, heading: impl Into<Option<String>>) -> Self {
        Self {
            name: name.into(),
            heading: heading.into(),
        }
    }

    fn with_opt_heading(&self, heading: Option<String>) -> Self {
        Self {
            name: self.name.clone(),
            heading,
        }
    }
}
impl std::fmt::Display for PageName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.name)?;
        if let Some(heading) = &self.heading {
            write!(f, "#{heading}")?;
        }
        Ok(())
    }
}
impl Serialize for PageName {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        match &self.heading {
            Some(heading) => serializer.serialize_str(&format!("{}#{}", self.name, heading)),
            None => serializer.serialize_str(&self.name),
        }
    }
}
impl<'de> Deserialize<'de> for PageName {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        Ok(match s.split_once('#') {
            Some((name, heading)) => PageName {
                name: name.to_string(),
                heading: Some(heading.to_string()),
            },
            None => PageName {
                name: s,
                heading: None,
            },
        })
    }
}

#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
/// A newtype for an ID assigned to a page for the graph.
pub struct PageDataId(pub usize);
impl Serialize for PageDataId {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.0.to_string())
    }
}
impl<'de> Deserialize<'de> for PageDataId {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        Ok(PageDataId(s.parse().map_err(serde::de::Error::custom)?))
    }
}
impl std::fmt::Display for PageDataId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "page_id:{}", self.0)
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
    wikipedia_index_path: PathBuf,
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
    let offsets_path = output_path.join("offsets.txt");
    let genres_path = output_path.join("genres");
    let redirects_path = output_path.join("all_redirects.toml");
    let links_to_articles_path = output_path.join("links_to_articles.toml");
    let processed_genres_path = output_path.join("processed");

    let website_path = Path::new("website");
    let website_public_path = website_path.join("public");
    let data_path = website_public_path.join("data.json");

    let start = std::time::Instant::now();

    let (genres, all_redirects) = extract_genres_and_all_redirects(
        &config,
        start,
        &offsets_path,
        &genres_path,
        &redirects_path,
    )?;

    let links_to_articles =
        resolve_links_to_articles(start, &links_to_articles_path, &genres, all_redirects)?;

    let mut processed_genres =
        process_genres(start, &genres, &links_to_articles, &processed_genres_path)?;

    remove_ignored_pages_and_detect_duplicates(&mut processed_genres);

    produce_data_json(
        start,
        dump_date,
        &data_path,
        &links_to_articles,
        &processed_genres,
    )?;

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
mod preparation_tests {
    use super::*;

    #[test]
    fn test_parse_wiki_dump_date() {
        assert_eq!(
            parse_wiki_dump_date("enwiki-20250123-pages-articles-multistream"),
            Some(jiff::civil::date(2025, 1, 23))
        );
        assert_eq!(parse_wiki_dump_date("invalid"), None);
    }
}

#[derive(Clone, Serialize, Deserialize)]
struct WikitextHeader {
    timestamp: jiff::Timestamp,
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
fn extract_genres_and_all_redirects(
    config: &Config,
    start: std::time::Instant,
    offsets_path: &Path,
    genres_path: &Path,
    redirects_path: &Path,
) -> anyhow::Result<(GenrePages, AllRedirects)> {
    // Already exists, just load from file
    if genres_path.is_dir() && redirects_path.is_file() {
        let mut genre_pages = HashMap::default();
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

    std::fs::create_dir_all(genres_path).context("Failed to create genres directory")?;

    // Load offsets to allow for multithreaded read
    let offsets = if offsets_path.exists() {
        let offsets_str =
            std::fs::read_to_string(offsets_path).context("Failed to read offsets file")?;
        let offsets: Vec<usize> = offsets_str
            .lines()
            .map(|line| line.parse().unwrap())
            .collect();
        println!(
            "{:.2}s: Loaded {} offsets from file",
            start.elapsed().as_secs_f32(),
            offsets.len(),
        );
        offsets
    } else {
        let index_file = std::fs::read(&config.wikipedia_index_path)
            .context("Failed to open Wikipedia index file")?;
        let index_file = std::io::BufReader::new(bzip2::bufread::BzDecoder::new(&index_file[..]));
        let mut offsets = BTreeSet::<usize>::new();
        for line in index_file.lines() {
            let line = line.context("Failed to read line from Wikipedia index file")?;
            let (offset, _) = line.split_once(':').context("Failed to split line")?;
            offsets.insert(offset.parse().unwrap());
        }
        let offsets: Vec<_> = offsets.into_iter().collect();
        let mut file =
            std::fs::File::create(offsets_path).context("Failed to create offsets file")?;
        for offset in &offsets {
            writeln!(file, "{}", offset).context("Failed to write offset to file")?;
        }
        println!(
            "{:.2}s: Extracted {} offsets from index and saved to file",
            start.elapsed().as_secs_f32(),
            offsets.len(),
        );
        offsets
    };

    // Memory-map dump into memory and hope the OS will evict the pages once we're done looking at them
    let dump_file = std::fs::File::open(&config.wikipedia_dump_path)
        .context("Failed to open Wikipedia dump")?;
    let dump_file =
        unsafe { memmap2::Mmap::map(&dump_file).context("Failed to memory-map Wikipedia dump")? };

    println!(
        "{:.2}s: opened Wikipedia dump",
        start.elapsed().as_secs_f32()
    );

    // Read the header of the file to extract the domain
    let wikipedia_domain = {
        let mut reader = quick_xml::reader::Reader::from_reader(std::io::BufReader::new(
            bzip2::bufread::BzDecoder::new(&dump_file[0..offsets[0]]),
        ));
        reader.config_mut().trim_text(true);

        let mut buf = vec![];

        let mut wikipedia_domain: String = String::new();
        let mut recording_wikipedia_domain = false;

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Eof) => break,
                Ok(Event::Start(e)) => {
                    let name = e.name().0;
                    if name == b"base" {
                        wikipedia_domain.clear();
                        recording_wikipedia_domain = true;
                    }
                }
                Ok(Event::Text(e)) => {
                    if recording_wikipedia_domain {
                        wikipedia_domain.push_str(&e.unescape().unwrap());
                    }
                }
                Ok(Event::End(e)) => {
                    if e.name().0 == b"base" {
                        recording_wikipedia_domain = false;
                        wikipedia_domain = extract_domain(&wikipedia_domain)
                            .expect("wikipedia_domain could not be extracted")
                            .to_string();
                    }
                }
                _ => {}
            }
            buf.clear();
        }

        if wikipedia_domain.is_empty() {
            anyhow::bail!("Failed to extract Wikipedia domain from dump");
        }

        wikipedia_domain
    };

    // Iterate over each offset (we'll make this multithreaded later)
    let (genre_pages, all_redirects) = offsets
        .par_iter()
        .fold(
            || {
                (
                    HashMap::<PageName, PathBuf>::default(),
                    HashMap::<PageName, PageName>::default(),
                )
            },
            |(mut genre_pages, mut all_redirects), &offset| {
                let mut reader = quick_xml::reader::Reader::from_reader(std::io::BufReader::new(
                    // We use an open-ended slice because BzDecoder will terminate after end of stream
                    bzip2::bufread::BzDecoder::new(&dump_file[offset..]),
                ));
                reader.config_mut().trim_text(true);

                let mut buf = vec![];

                let mut title = String::new();
                let mut recording_title = false;

                let mut text = String::new();
                let mut recording_text = false;

                let mut timestamp = String::new();
                let mut recording_timestamp = false;

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
                            } else if name == b"timestamp" {
                                timestamp.clear();
                                recording_timestamp = true;
                            }
                        }
                        Ok(Event::Text(e)) => {
                            if recording_title {
                                title.push_str(&e.unescape().unwrap());
                            } else if recording_text {
                                text.push_str(&e.unescape().unwrap());
                            } else if recording_timestamp {
                                timestamp.push_str(&e.unescape().unwrap());
                            }
                        }
                        Ok(Event::End(e)) => {
                            if e.name().0 == b"title" {
                                recording_title = false;
                            } else if e.name().0 == b"text" {
                                recording_text = false;
                            } else if e.name().0 == b"timestamp" {
                                recording_timestamp = false;
                            } else if e.name().0 == b"page" {
                                let page = PageName {
                                    name: title.clone(),
                                    heading: None,
                                };
                                if text.starts_with("#REDIRECT") {
                                    match parse_redirect_text(&wikipedia_domain, &text) {
                                        Ok(redirect) => {
                                            all_redirects.insert(page.clone(), redirect);
                                        }
                                        Err(e) => {
                                            eprintln!("Error parsing redirect: {e:?}");
                                        }
                                    }
                                } else if text.contains("nfobox music genre") {
                                    if title.contains(":") {
                                        continue;
                                    }

                                    let timestamp = timestamp
                                        .parse::<jiff::Timestamp>()
                                        .with_context(|| {
                                            format!(
                                                "Failed to parse timestamp {timestamp} for {page}"
                                            )
                                        })
                                        .unwrap();

                                    let output_file_path = genres_path
                                        .join(format!("{}.wikitext", sanitize_page_name(&page)));
                                    let output_file = std::fs::File::create(&output_file_path)
                                        .with_context(|| {
                                            format!("Failed to create output file for {page}")
                                        })
                                        .unwrap();
                                    let mut output_file = std::io::BufWriter::new(output_file);

                                    writeln!(
                                        output_file,
                                        "{}",
                                        serde_json::to_string(&WikitextHeader { timestamp })
                                            .unwrap()
                                    )
                                    .unwrap();
                                    write!(output_file, "{text}").unwrap();

                                    genre_pages.insert(page.clone(), output_file_path);
                                    println!("{:.2}s: {page}", start.elapsed().as_secs_f32());
                                }
                            }
                        }
                        _ => {}
                    }
                    buf.clear();
                }

                (genre_pages, all_redirects)
            },
        )
        .reduce(
            || {
                (
                    HashMap::<PageName, PathBuf>::default(),
                    HashMap::<PageName, PageName>::default(),
                )
            },
            |(mut genre_pages, mut all_redirects), (new_genre_pages, new_all_redirects)| {
                genre_pages.extend(new_genre_pages);
                all_redirects.extend(new_all_redirects);
                (genre_pages, all_redirects)
            },
        );

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

fn extract_domain(url: &str) -> Option<&str> {
    let domain_start = url.find("://")? + 3;
    let domain_end = url[domain_start..].find('/')?;
    Some(&url[domain_start..domain_start + domain_end])
}

#[derive(Debug)]
pub enum RedirectParseError {
    InvalidRedirect { text: String },
    ExternalLinkNotOnThisWiki { text: String },
}
impl std::fmt::Display for RedirectParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RedirectParseError::InvalidRedirect { text } => {
                write!(f, "Invalid redirect format: {}", text)
            }
            RedirectParseError::ExternalLinkNotOnThisWiki { text } => {
                write!(f, "External link not on this wiki: {}", text)
            }
        }
    }
}
impl std::error::Error for RedirectParseError {}
fn parse_redirect_text(wikipedia_domain: &str, text: &str) -> Result<PageName, RedirectParseError> {
    // Find the first [[...]] link or [http://... ...] link
    let start = if let Some(pos) = text.find("[[") {
        pos + 2
    } else if let Some(pos) = text.find("[http") {
        // Find the end of the link
        let link_end =
            text[pos..]
                .find(']')
                .ok_or_else(|| RedirectParseError::InvalidRedirect {
                    text: text.to_string(),
                })?
                + pos;
        let link = &text[pos + 1..link_end];

        // Extract the URL and verify domain
        let url_end = link
            .find(' ')
            .ok_or_else(|| RedirectParseError::InvalidRedirect {
                text: text.to_string(),
            })?;
        let url = &link[..url_end];

        let domain =
            extract_domain(url).ok_or_else(|| RedirectParseError::ExternalLinkNotOnThisWiki {
                text: text.to_string(),
            })?;

        if domain != wikipedia_domain {
            return Err(RedirectParseError::ExternalLinkNotOnThisWiki {
                text: text.to_string(),
            });
        }

        // Find the page title between title= and &
        let title_start =
            url.find("title=")
                .ok_or_else(|| RedirectParseError::ExternalLinkNotOnThisWiki {
                    text: text.to_string(),
                })?
                + 6;
        let title_end = url[title_start..].find('&').ok_or_else(|| {
            RedirectParseError::ExternalLinkNotOnThisWiki {
                text: text.to_string(),
            }
        })? + title_start;
        let page_title = &url[title_start..title_end];

        return Ok(PageName {
            name: page_title.to_string(),
            heading: None,
        });
    } else {
        return Err(RedirectParseError::InvalidRedirect {
            text: text.to_string(),
        });
    };

    let end = text[start..]
        .find("]]")
        .ok_or_else(|| RedirectParseError::InvalidRedirect {
            text: text.to_string(),
        })?
        + start;
    let link = &text[start..end];

    // Split on # if there's a section heading
    if let Some((page, heading)) = link.split_once('#') {
        Ok(PageName {
            name: page.to_string(),
            heading: Some(heading.to_string()),
        })
    } else {
        Ok(PageName {
            name: link.to_string(),
            heading: None,
        })
    }
}

#[cfg(test)]
mod extraction_tests {
    use super::*;

    const WIKIPEDIA_DOMAIN: &str = "en.wikipedia.org";

    #[test]
    fn test_extract_wiki_domain() {
        assert_eq!(
            extract_domain("https://en.wikipedia.org/wiki/Main_Page"),
            Some("en.wikipedia.org")
        );
        assert_eq!(
            extract_domain("http://en.wikipedia.org/something"),
            Some("en.wikipedia.org")
        );
        assert_eq!(extract_domain("not a url"), None);
        assert_eq!(extract_domain("https://bad"), None);
        assert_eq!(extract_domain(""), None);
    }

    #[test]
    fn test_parse_redirect_basic() {
        let text = "#REDIRECT [[United Kingdom]]";
        let result = parse_redirect_text(WIKIPEDIA_DOMAIN, text).unwrap();
        assert_eq!(
            result,
            PageName {
                name: "United Kingdom".to_string(),
                heading: None,
            }
        );
    }

    #[test]
    fn test_parse_redirect_with_heading() {
        let text = "#REDIRECT [[UK hard house#Scouse house]]";
        let result = parse_redirect_text(WIKIPEDIA_DOMAIN, text).unwrap();
        assert_eq!(
            result,
            PageName {
                name: "UK hard house".to_string(),
                heading: Some("Scouse house".to_string()),
            }
        );
    }

    #[test]
    fn test_parse_redirect_multiline() {
        let text = "#REDIRECT [[UK hard house#Scouse house]]
{{Redirect category shell|
{{R to section}}
}}

[[Category:House music genres]]";
        let result = parse_redirect_text(WIKIPEDIA_DOMAIN, text).unwrap();
        assert_eq!(
            result,
            PageName {
                name: "UK hard house".to_string(),
                heading: Some("Scouse house".to_string()),
            }
        );
    }

    #[test]
    fn test_parse_redirect_invalid() {
        let text = "Not a redirect";
        assert!(matches!(
            parse_redirect_text(WIKIPEDIA_DOMAIN, text),
            Err(RedirectParseError::InvalidRedirect { text: _ })
        ));
    }

    #[test]
    fn test_parse_redirect_http() {
        let text = "#REDIRECT [http://en.wikipedia.org/w/index.php?title=Wikipedia:WikiProject_Seattle_Mariners/right_side&action=edit right panel]";
        let result = parse_redirect_text(WIKIPEDIA_DOMAIN, text).unwrap();
        assert_eq!(
            result,
            PageName {
                name: "Wikipedia:WikiProject_Seattle_Mariners/right_side".to_string(),
                heading: None,
            }
        );
    }

    #[test]
    fn test_parse_redirect_external_link_invalid() {
        let text = "#REDIRECT [http://example.com some text]";
        assert!(matches!(
            parse_redirect_text(WIKIPEDIA_DOMAIN, text),
            Err(RedirectParseError::ExternalLinkNotOnThisWiki { text: _ })
        ));
    }
}
pub struct LinksToArticles(pub HashMap<String, PageName>);
impl LinksToArticles {
    pub fn map(&self, link: &str) -> Option<PageName> {
        self.0.get(&link.to_lowercase()).map(|s| s.to_owned())
    }
}
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
        .map(|s| (s.to_string().to_lowercase(), s.clone()))
        .collect();

    let mut round = 1;
    loop {
        let mut added = false;
        for (page, redirect) in &all_redirects {
            let page = page.to_string().to_lowercase();
            let redirect = redirect.to_string().to_lowercase();

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

struct NodeMetadata<'a> {
    name: &'static str,
    start: usize,
    end: usize,
    children: Option<&'a [pwt::Node<'a>]>,
}
impl<'a> NodeMetadata<'a> {
    fn new(
        name: &'static str,
        start: usize,
        end: usize,
        children: Option<&'a [pwt::Node<'a>]>,
    ) -> Self {
        Self {
            name,
            start,
            end,
            children,
        }
    }
}
fn node_metadata<'a>(node: &'a pwt::Node) -> NodeMetadata<'a> {
    use NodeMetadata as NM;
    match node {
        pwt::Node::Bold { end, start } => NM::new("bold", *start, *end, None),
        pwt::Node::BoldItalic { end, start } => NM::new("bold_italic", *start, *end, None),
        pwt::Node::Category { end, start, .. } => NM::new("category", *start, *end, None),
        pwt::Node::CharacterEntity { end, start, .. } => {
            NM::new("character_entity", *start, *end, None)
        }
        pwt::Node::Comment { end, start } => NM::new("comment", *start, *end, None),
        pwt::Node::DefinitionList {
            end,
            start,
            items: _,
        } => NM::new("definition_list", *start, *end, None),
        pwt::Node::EndTag { end, start, .. } => NM::new("end_tag", *start, *end, None),
        pwt::Node::ExternalLink { end, nodes, start } => {
            NM::new("external_link", *start, *end, Some(nodes))
        }
        pwt::Node::Heading {
            end, start, nodes, ..
        } => NM::new("heading", *start, *end, Some(nodes)),
        pwt::Node::HorizontalDivider { end, start } => {
            NM::new("horizontal_divider", *start, *end, None)
        }
        pwt::Node::Image {
            end, start, text, ..
        } => NM::new("image", *start, *end, Some(text)),
        pwt::Node::Italic { end, start } => NM::new("italic", *start, *end, None),
        pwt::Node::Link {
            end, start, text, ..
        } => NM::new("link", *start, *end, Some(text)),
        pwt::Node::MagicWord { end, start } => NM::new("magic_word", *start, *end, None),
        pwt::Node::OrderedList {
            end,
            start,
            items: _,
        } => NM::new("ordered_list", *start, *end, None),
        pwt::Node::ParagraphBreak { end, start } => NM::new("paragraph_break", *start, *end, None),
        pwt::Node::Parameter { end, start, .. } => NM::new("parameter", *start, *end, None),
        pwt::Node::Preformatted { end, start, nodes } => {
            NM::new("preformatted", *start, *end, Some(nodes))
        }
        pwt::Node::Redirect { end, start, .. } => NM::new("redirect", *start, *end, None),
        pwt::Node::StartTag { end, start, .. } => NM::new("start_tag", *start, *end, None),
        pwt::Node::Table {
            end,
            start,
            rows: _,
            ..
        } => NM::new("table", *start, *end, None),
        pwt::Node::Tag {
            end, start, nodes, ..
        } => NM::new("tag", *start, *end, Some(nodes.as_slice())),
        pwt::Node::Template { end, start, .. } => NM::new("template", *start, *end, None),
        pwt::Node::Text { end, start, .. } => NM::new("text", *start, *end, None),
        pwt::Node::UnorderedList {
            end,
            start,
            items: _,
        } => NM::new("unordered_list", *start, *end, None),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
enum SimplifiedWikitextNode {
    #[serde(rename = "fragment")]
    Fragment {
        children: Vec<SimplifiedWikitextNode>,
    },
    #[serde(rename = "template")]
    Template {
        name: String,
        children: Vec<TemplateParameter>,
    },
    #[serde(rename = "link")]
    Link {
        text: String,
        title: String,

        // I don't love including this project-specific field within this, but there isn't an cleaner way to do this
        // without having a duplicate version of this enum.
        #[serde(skip_serializing_if = "Option::is_none")]
        genre_id: Option<PageDataId>,
    },
    #[serde(rename = "ext-link")]
    ExtLink { text: String, link: String },
    #[serde(rename = "bold")]
    Bold {
        children: Vec<SimplifiedWikitextNode>,
    },
    #[serde(rename = "italic")]
    Italic {
        children: Vec<SimplifiedWikitextNode>,
    },
    #[serde(rename = "blockquote")]
    Blockquote {
        children: Vec<SimplifiedWikitextNode>,
    },
    #[serde(rename = "superscript")]
    Superscript {
        children: Vec<SimplifiedWikitextNode>,
    },
    #[serde(rename = "subscript")]
    Subscript {
        children: Vec<SimplifiedWikitextNode>,
    },
    #[serde(rename = "small")]
    Small {
        children: Vec<SimplifiedWikitextNode>,
    },
    #[serde(rename = "preformatted")]
    Preformatted {
        children: Vec<SimplifiedWikitextNode>,
    },
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "paragraph_break")]
    ParagraphBreak,
    #[serde(rename = "newline")]
    Newline,
}
impl SimplifiedWikitextNode {
    fn children(&self) -> Option<&[SimplifiedWikitextNode]> {
        match self {
            Self::Fragment { children } => Some(children),
            Self::Bold { children } => Some(children),
            Self::Italic { children } => Some(children),
            Self::Blockquote { children } => Some(children),
            Self::Superscript { children } => Some(children),
            Self::Subscript { children } => Some(children),
            Self::Small { children } => Some(children),
            Self::Preformatted { children } => Some(children),
            _ => None,
        }
    }
    fn children_mut(&mut self) -> Option<&mut Vec<SimplifiedWikitextNode>> {
        match self {
            Self::Fragment { children } => Some(children),
            Self::Bold { children } => Some(children),
            Self::Italic { children } => Some(children),
            Self::Blockquote { children } => Some(children),
            Self::Superscript { children } => Some(children),
            Self::Subscript { children } => Some(children),
            Self::Small { children } => Some(children),
            Self::Preformatted { children } => Some(children),
            _ => None,
        }
    }
    fn visit_mut(&mut self, visitor: &mut impl FnMut(&mut Self)) {
        visitor(self);
        if let Some(children) = self.children_mut() {
            for child in children {
                child.visit_mut(visitor);
            }
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
#[serde(rename = "parameter")]
struct TemplateParameter {
    name: String,
    value: String,
}

fn simplify_wikitext_nodes(wikitext: &str, nodes: &[pwt::Node]) -> Vec<SimplifiedWikitextNode> {
    use SimplifiedWikitextNode as SWN;
    struct RootStack {
        stack: Vec<SWN>,
    }
    impl RootStack {
        fn new() -> Self {
            Self {
                stack: vec![SWN::Fragment { children: vec![] }],
            }
        }
        fn push_layer(&mut self, node: SWN) {
            self.stack.push(node);
        }
        fn pop_layer(&mut self) -> SWN {
            self.stack.pop().unwrap()
        }
        fn last_layer(&self) -> &SWN {
            self.stack.last().unwrap()
        }
        fn add_to_children(&mut self, node: SWN) {
            self.stack
                .last_mut()
                .unwrap()
                .children_mut()
                .unwrap()
                .push(node);
        }
        fn unwind(mut self) -> Vec<SWN> {
            // This is a disgusting hack, but Wikipedia implicitly closes these, so we need to as well...
            while self.stack.len() > 1 {
                let popped = self.pop_layer();
                self.add_to_children(popped);
            }
            self.stack[0].children().unwrap().to_vec()
        }
    }
    let mut root_stack = RootStack::new();

    for node in nodes {
        match node {
            pwt::Node::Bold { .. } => {
                if matches!(root_stack.last_layer(), SWN::Bold { .. }) {
                    let bold = root_stack.pop_layer();
                    root_stack.add_to_children(bold);
                } else {
                    root_stack.push_layer(SWN::Bold { children: vec![] });
                }
            }
            pwt::Node::Italic { .. } => {
                if matches!(root_stack.last_layer(), SWN::Italic { .. }) {
                    let italic = root_stack.pop_layer();
                    root_stack.add_to_children(italic);
                } else {
                    root_stack.push_layer(SWN::Italic { children: vec![] });
                }
            }
            pwt::Node::BoldItalic { .. } => {
                if matches!(root_stack.last_layer(), SWN::Italic { .. }) {
                    let italic = root_stack.pop_layer();
                    if matches!(root_stack.last_layer(), SWN::Bold { .. }) {
                        let mut bold = root_stack.pop_layer();
                        bold.children_mut().unwrap().push(italic);
                        root_stack.add_to_children(bold);
                    } else {
                        panic!("BoldItalic found without a bold layer");
                    }
                } else {
                    root_stack.push_layer(SWN::Bold { children: vec![] });
                    root_stack.push_layer(SWN::Italic { children: vec![] });
                }
            }
            pwt::Node::StartTag { name, .. } if name == "blockquote" => {
                root_stack.push_layer(SWN::Blockquote { children: vec![] });
            }
            pwt::Node::EndTag { name, .. } if name == "blockquote" => {
                let blockquote = root_stack.pop_layer();
                root_stack.add_to_children(blockquote);
            }
            pwt::Node::StartTag { name, .. } if name == "sup" => {
                root_stack.push_layer(SWN::Superscript { children: vec![] });
            }
            pwt::Node::EndTag { name, .. } if name == "sup" => {
                let superscript = root_stack.pop_layer();
                root_stack.add_to_children(superscript);
            }
            pwt::Node::StartTag { name, .. } if name == "sub" => {
                root_stack.push_layer(SWN::Subscript { children: vec![] });
            }
            pwt::Node::EndTag { name, .. } if name == "sub" => {
                let subscript = root_stack.pop_layer();
                root_stack.add_to_children(subscript);
            }
            pwt::Node::StartTag { name, .. } if name == "small" => {
                root_stack.push_layer(SWN::Small { children: vec![] });
            }
            pwt::Node::EndTag { name, .. } if name == "small" => {
                let small = root_stack.pop_layer();
                root_stack.add_to_children(small);
            }
            other => {
                if let Some(simplified_node) = simplify_wikitext_node(wikitext, other) {
                    root_stack.add_to_children(simplified_node);
                }
            }
        }
    }

    root_stack.unwind()
}

fn simplify_wikitext_node(wikitext: &str, node: &pwt::Node) -> Option<SimplifiedWikitextNode> {
    use SimplifiedWikitextNode as SWN;
    match node {
        pwt::Node::Template {
            name, parameters, ..
        } => {
            let mut unnamed_parameter_index = 1;
            let mut children = vec![];
            for parameter in parameters {
                let name = if let Some(parameter_name) = &parameter.name {
                    nodes_inner_text(parameter_name, &InnerTextConfig::default())
                } else {
                    let name = unnamed_parameter_index.to_string();
                    unnamed_parameter_index += 1;
                    name
                };

                let value_start = parameter
                    .value
                    .first()
                    .map(|v| node_metadata(v).start)
                    .unwrap_or_default();
                let value_end = parameter
                    .value
                    .last()
                    .map(|v| node_metadata(v).end)
                    .unwrap_or_default();
                let value = wikitext[value_start..value_end].to_string();

                children.push(TemplateParameter { name, value });
            }

            return Some(SWN::Template {
                name: nodes_inner_text(name, &InnerTextConfig::default()),
                children,
            });
        }
        pwt::Node::MagicWord { .. } => {
            // Making the current assumption that we don't care about these
            return None;
        }
        pwt::Node::Bold { .. } | pwt::Node::BoldItalic { .. } | pwt::Node::Italic { .. } => {
            // We can't do anything at this level
            return None;
        }
        pwt::Node::Link { target, text, .. } => {
            return Some(SWN::Link {
                text: nodes_inner_text(text, &InnerTextConfig::default()),
                title: target.to_string(),
                genre_id: None,
            });
        }
        pwt::Node::ExternalLink { nodes, .. } => {
            let inner = nodes_inner_text(nodes, &InnerTextConfig::default());
            let (text, link) = inner.split_once(' ').unwrap_or(("link", &inner));
            return Some(SWN::ExtLink {
                text: text.to_string(),
                link: link.to_string(),
            });
        }
        pwt::Node::Text { value, .. } => {
            return Some(SWN::Text {
                text: value.to_string(),
            });
        }
        pwt::Node::CharacterEntity { character, .. } => {
            return Some(SWN::Text {
                text: character.to_string(),
            });
        }
        pwt::Node::ParagraphBreak { .. } => {
            return Some(SWN::ParagraphBreak);
        }
        pwt::Node::Category { .. } | pwt::Node::Comment { .. } | pwt::Node::Image { .. } => {
            // Don't care
            return None;
        }
        pwt::Node::DefinitionList { .. }
        | pwt::Node::OrderedList { .. }
        | pwt::Node::UnorderedList { .. } => {
            // Temporarily ignore these
            return None;
        }
        pwt::Node::Tag { name, .. }
            if ["nowiki", "references", "gallery"].contains(&name.as_ref()) =>
        {
            // Don't care
            return None;
        }
        pwt::Node::StartTag { name, .. } if name == "br" => {
            return Some(SWN::Newline);
        }
        pwt::Node::Preformatted { nodes, .. } => {
            return Some(SWN::Preformatted {
                children: simplify_wikitext_nodes(wikitext, nodes),
            });
        }
        _ => {}
    }
    let metadata = node_metadata(node);
    panic!(
        "Unknown node type: {:?}: {:?}",
        node,
        &wikitext[metadata.start..metadata.end]
    );
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct ProcessedGenre {
    name: GenreName,
    page: PageName,
    wikitext_description: Option<Vec<SimplifiedWikitextNode>>,
    last_revision_date: jiff::Timestamp,
    stylistic_origins: Vec<PageName>,
    derivatives: Vec<PageName>,
    subgenres: Vec<PageName>,
    fusion_genres: Vec<PageName>,
}
impl ProcessedGenre {
    pub fn update_description(
        &mut self,
        pwt_configuration: &pwt::Configuration,
        description: &str,
    ) {
        let nodes = pwt_configuration.parse(description).unwrap().nodes;
        self.wikitext_description = Some(simplify_wikitext_nodes(description, &nodes));
    }

    pub fn save(&self, processed_genres_path: &Path) -> anyhow::Result<()> {
        std::fs::write(
            processed_genres_path.join(format!("{}.json", sanitize_page_name(&self.page))),
            serde_json::to_string_pretty(self)?,
        )?;
        Ok(())
    }
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
                serde_json::from_str(&std::fs::read_to_string(path)?)?,
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

    let dump_page = std::env::var("DUMP_PAGE").ok();

    fn dump_page_nodes(wikitext: &str, nodes: &[pwt::Node], depth: usize) {
        for node in nodes {
            print!("{:indent$}", "", indent = depth * 2);
            let metadata = node_metadata(node);
            println!(
                "{}[{}..{}]: {:?}",
                metadata.name,
                metadata.start,
                metadata.end,
                &wikitext[metadata.start..metadata.end]
            );
            if let Some(children) = metadata.children {
                dump_page_nodes(wikitext, children, depth + 1);
            }
        }
    }

    /// This is monstrous.
    /// We are parsing the Wikitext, reconstructing it without the comments, and then parsing it again.
    ///
    /// This is necessary as parse-wiki-text has a bug in which it does not recognise headings
    /// where comments immediately follow - i.e.
    ///   ===Heading===<!-- Lmao -->
    /// results in `===Heading===` being parsed as text, not a heading.
    ///
    /// Ideally, this would be fixed upstream, but that looks like a non-trivial fix, and
    /// compute and memory is cheap, so... here we go.
    fn remove_comments_from_wikitext_the_painful_way(
        pwt_configuration: &pwt::Configuration,
        dump_page: Option<&str>,
        page: &PageName,
        wikitext: &str,
    ) -> String {
        let parsed_wikitext = pwt_configuration
            .parse_with_timeout(wikitext, std::time::Duration::from_secs(1))
            .unwrap_or_else(|e| panic!("failed to parse wikitext ({page}): {e:?}"));

        let mut new_wikitext = wikitext.to_string();
        let mut comment_ranges = vec![];

        if dump_page.is_some_and(|s| s == page.name) {
            println!("--- BEFORE ---");
            dump_page_nodes(wikitext, &parsed_wikitext.nodes, 0);
        }

        for node in &parsed_wikitext.nodes {
            if let pwt::Node::Comment { start, end, .. } = node {
                comment_ranges.push((*start, *end));
            }
        }

        for (start, end) in comment_ranges.into_iter().rev() {
            new_wikitext.replace_range(start..end, "");
        }
        new_wikitext
    }

    for (original_page, path) in genres.iter() {
        let wikitext = std::fs::read_to_string(path)?;
        let (wikitext_header, wikitext) = wikitext.split_once("\n").unwrap();
        let wikitext_header: WikitextHeader = serde_json::from_str(wikitext_header)?;

        let wikitext = remove_comments_from_wikitext_the_painful_way(
            &pwt_configuration,
            dump_page.as_deref(),
            original_page,
            wikitext,
        );
        let parsed_wikitext = pwt_configuration
            .parse_with_timeout(&wikitext, std::time::Duration::from_secs(1))
            .unwrap_or_else(|e| panic!("failed to parse wikitext ({original_page}): {e:?}"));
        if dump_page
            .as_deref()
            .is_some_and(|s| s == original_page.name)
        {
            println!("--- AFTER ---");
            dump_page_nodes(&wikitext, &parsed_wikitext.nodes, 0);
        }

        let mut description: Option<String> = None;
        let mut pause_recording_description = false;
        // The `start` of a node doesn't always correspond to the `end` of the last node,
        // so we always save the `end` to allow for full reconstruction in the description.
        let mut last_end = None;
        fn start_including_last_end(last_end: &mut Option<usize>, start: usize) -> usize {
            last_end.take().filter(|&end| end < start).unwrap_or(start)
        }
        let mut last_heading = None;

        let mut processed_genre: Option<ProcessedGenre> = None;

        for node in &parsed_wikitext.nodes {
            match node {
                pwt::Node::Template {
                    name,
                    parameters,
                    start,
                    end,
                    ..
                } => {
                    let template_name =
                        nodes_inner_text(name, &InnerTextConfig::default()).to_lowercase();

                    // If we're recording the description and there are non-whitespace characters,
                    // this template can be recorded (i.e. "a {{blah}}" is acceptable, "{{blah}}" is not).
                    //
                    // Alternatively, a select list of acceptable templates can be included in the capture,
                    // regardless of the existing description.
                    //
                    // However, there are also some templates where we really don't care about preserving them.
                    if let Some(description) = &mut description {
                        fn is_acceptable_template(template_name: &str) -> bool {
                            static ACCEPTABLE_TEMPLATES: LazyLock<HashSet<&'static str>> =
                                LazyLock::new(|| {
                                    HashSet::from_iter([
                                        "nihongo",
                                        "transliteration",
                                        "tlit",
                                        "transl",
                                        "lang",
                                    ])
                                });
                            ACCEPTABLE_TEMPLATES.contains(template_name)
                        }

                        fn is_ignorable_template(template_name: &str) -> bool {
                            template_name.starts_with("use")
                        }

                        if !pause_recording_description
                            && (!description.trim().is_empty()
                                || is_acceptable_template(&template_name))
                            && !is_ignorable_template(&template_name)
                        {
                            description.push_str(
                                &wikitext[start_including_last_end(&mut last_end, *start)..*end],
                            );
                        }
                    }
                    last_end = Some(*end);

                    if template_name != "infobox music genre" {
                        continue;
                    }

                    // If we already have a processed genre, save it
                    if let Some(mut processed_genre) = processed_genre.take() {
                        let new_page = processed_genre.page.clone();
                        if let Some(description) = description.take() {
                            processed_genre.update_description(&pwt_configuration, &description);
                        }
                        processed_genres.insert(new_page.clone(), processed_genre.clone());
                        processed_genre.save(processed_genres_path)?;
                        if dump_page
                            .as_deref()
                            .is_some_and(|s| s == original_page.name)
                        {
                            println!(
                                "Saving due to new genre: {new_page:?} | {}",
                                processed_genre.name
                            );
                            println!("Description: {:?}", processed_genre.wikitext_description);
                        }
                    }

                    let parameters = parameters_to_map(parameters);
                    let mut name = GenreName(match parameters.get("name") {
                        None | Some([]) => original_page
                            .heading
                            .as_ref()
                            .unwrap_or(&original_page.name)
                            .clone(),
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
                                panic!(
                                    "Failed to extract name from {original_page}, params: {parameters:?}"
                                );
                            }
                            name
                        }
                    });
                    if let Some((timestamp, new_name)) = all_patches.get(original_page) {
                        // Check whether the article has been updated since the last revision date
                        // with one minute of leeway. If it has, don't apply the patch.
                        if timestamp
                            .map(|ts| wikitext_header.timestamp.saturating_add(1.minute()) < ts)
                            .unwrap_or(true)
                        {
                            name = new_name.clone();
                        }
                    }
                    let map_links_to_articles = |links: Vec<String>| -> Vec<PageName> {
                        links
                            .into_iter()
                            .filter_map(|link| links_to_articles.map(&link))
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

                    processed_genre = Some(ProcessedGenre {
                        name: name.clone(),
                        page: original_page.with_opt_heading(last_heading.clone()),
                        wikitext_description: None,
                        last_revision_date: wikitext_header.timestamp,
                        stylistic_origins,
                        derivatives,
                        subgenres,
                        fusion_genres,
                    });
                    description = Some(String::new());
                }
                pwt::Node::StartTag { name, end, .. } if name == "ref" => {
                    pause_recording_description = true;
                    last_end = Some(*end);
                }
                pwt::Node::EndTag { name, end, .. } if name == "ref" => {
                    pause_recording_description = false;
                    last_end = Some(*end);
                }
                pwt::Node::Tag { name, end, .. } if name == "ref" => {
                    // Explicitly ignore body of a ref tag
                    last_end = Some(*end);
                }
                pwt::Node::Bold { end, start }
                | pwt::Node::BoldItalic { end, start }
                | pwt::Node::Category { end, start, .. }
                | pwt::Node::CharacterEntity { end, start, .. }
                | pwt::Node::DefinitionList { end, start, .. }
                | pwt::Node::ExternalLink { end, start, .. }
                | pwt::Node::HorizontalDivider { end, start }
                | pwt::Node::Italic { end, start }
                | pwt::Node::Link { end, start, .. }
                | pwt::Node::MagicWord { end, start }
                | pwt::Node::OrderedList { end, start, .. }
                | pwt::Node::ParagraphBreak { end, start }
                | pwt::Node::Parameter { end, start, .. }
                | pwt::Node::Preformatted { end, start, .. }
                | pwt::Node::Redirect { end, start, .. }
                | pwt::Node::StartTag { end, start, .. }
                | pwt::Node::EndTag { end, start, .. }
                | pwt::Node::Table { end, start, .. }
                | pwt::Node::Tag { end, start, .. }
                | pwt::Node::Text { end, start, .. }
                | pwt::Node::UnorderedList { end, start, .. } => {
                    if !pause_recording_description {
                        if let Some(description) = &mut description {
                            let new_start = start_including_last_end(&mut last_end, *start);
                            let new_fragment = &wikitext[new_start..*end];
                            if dump_page
                                .as_deref()
                                .is_some_and(|s| s == original_page.name)
                            {
                                println!("Description: {description:?}");
                                println!("New fragment: {new_fragment:?}");
                                println!("New start: {new_start} vs start: {start}");
                                println!("End: {end}");
                                println!();
                            }
                            description.push_str(new_fragment);
                        }
                    }
                    last_end = Some(*end);
                }
                pwt::Node::Heading { nodes, end, .. } => {
                    if let Some(processed_genre) = &mut processed_genre {
                        // We continue going if the description so far is empty: some infoboxes are placed
                        // before a heading, with the content following after the heading, so we offer
                        // this as an opportunity to capture that content.
                        if description.as_ref().is_some_and(|s| !s.trim().is_empty()) {
                            processed_genre.update_description(
                                &pwt_configuration,
                                &description.take().unwrap(),
                            );
                            processed_genre.page =
                                processed_genre.page.with_opt_heading(last_heading.clone());
                        } else {
                            last_end = Some(*end);
                        }
                    }

                    last_heading = Some(nodes_inner_text(nodes, &InnerTextConfig::default()));
                }
                pwt::Node::Image { end, .. } | pwt::Node::Comment { end, .. } => {
                    last_end = Some(*end);
                }
            }
        }

        if let Some(processed_genre) = &mut processed_genre {
            let new_page = processed_genre.page.clone();
            if let Some(description) = description.take() {
                processed_genre.update_description(&pwt_configuration, &description);
            }
            processed_genres.insert(new_page.clone(), processed_genre.clone());
            processed_genre.save(processed_genres_path)?;
            if dump_page
                .as_deref()
                .is_some_and(|s| s == original_page.name)
            {
                println!("End-of-page save: {new_page:?} | {}", processed_genre.name);
                println!("Description: {:?}", processed_genre.wikitext_description);
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
    id: PageDataId,
    page_title: PageName,
    wikitext_description: Option<Vec<SimplifiedWikitextNode>>,
    label: GenreName,
    last_revision_date: jiff::Timestamp,
    links: BTreeSet<usize>,
}
#[derive(Debug, Serialize, Deserialize, Hash, PartialEq, Eq, PartialOrd, Ord)]
enum LinkType {
    Derivative,
    Subgenre,
    FusionGenre,
}
#[derive(Debug, Serialize, Deserialize, Hash, PartialEq, Eq, PartialOrd, Ord)]
struct LinkData {
    source: PageDataId,
    target: PageDataId,
    ty: LinkType,
}

/// Given processed genres, produce a graph and save it to file to be rendered by the website.
fn produce_data_json(
    start: std::time::Instant,
    dump_date: jiff::civil::Date,
    data_path: &Path,
    links_to_articles: &LinksToArticles,
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

    let mut page_to_id = HashMap::new();

    // First pass: create nodes
    for page in &node_order {
        let processed_genre = &processed_genres.0[page];
        let id = PageDataId(graph.nodes.len());
        let node = NodeData {
            id,
            page_title: page.clone(),
            wikitext_description: processed_genre.wikitext_description.clone(),
            label: processed_genre.name.clone(),
            last_revision_date: processed_genre.last_revision_date,
            links: BTreeSet::new(),
        };

        graph.nodes.push(node);
        page_to_id.insert(page.clone(), id);
        let page_without_heading = page.with_opt_heading(None);
        // Add fallback page ID for pages where the main music box is under a heading
        page_to_id.entry(page_without_heading).or_insert(id);
    }

    // Second pass: create links
    for page in &node_order {
        let processed_genre = &processed_genres.0[page];
        let genre_id = *page_to_id.get(page).with_context(|| {
            format!(
                "{}: Missing page ID for genre `{page}`",
                processed_genre.page
            )
        })?;
        for stylistic_origin in &processed_genre.stylistic_origins {
            graph.links.insert(LinkData {
                source: *page_to_id.get(stylistic_origin).with_context(|| {
                    format!(
                        "{}: Missing page ID for stylistic origin `{stylistic_origin}`",
                        processed_genre.page
                    )
                })?,
                target: genre_id,
                ty: LinkType::Derivative,
            });
        }
        for derivative in &processed_genre.derivatives {
            graph.links.insert(LinkData {
                source: genre_id,
                target: *page_to_id.get(derivative).with_context(|| {
                    format!(
                        "{}: Missing page ID for derivative `{derivative}`",
                        processed_genre.page
                    )
                })?,
                ty: LinkType::Derivative,
            });
        }
        for subgenre in &processed_genre.subgenres {
            graph.links.insert(LinkData {
                source: genre_id,
                target: *page_to_id.get(subgenre).with_context(|| {
                    format!(
                        "{}: Missing page ID for subgenre `{subgenre}`",
                        processed_genre.page
                    )
                })?,
                ty: LinkType::Subgenre,
            });
        }
        for fusion_genre in &processed_genre.fusion_genres {
            graph.links.insert(LinkData {
                source: genre_id,
                target: *page_to_id.get(fusion_genre).with_context(|| {
                    format!(
                        "{}: Missing page ID for fusion genre `{fusion_genre}`",
                        processed_genre.page
                    )
                })?,
                ty: LinkType::FusionGenre,
            });
        }
        // If this genre comes from a heading of another page, attempt to add the parent page
        // as a subgenre relationship.
        if page.heading.is_some() {
            if let Some(parent_page) = page_to_id.get(&page.with_opt_heading(None)) {
                graph.links.insert(LinkData {
                    source: *parent_page,
                    target: genre_id,
                    ty: LinkType::Subgenre,
                });
            }
        }
    }

    // Third pass (over links): update inbound/outbound sets
    for (i, link) in graph.links.iter().enumerate() {
        graph.nodes[link.source.0].links.insert(i);
        graph.nodes[link.target.0].links.insert(i);
    }

    // Fourth pass: calculate max degree
    graph.max_degree = graph.nodes.iter().map(|n| n.links.len()).max().unwrap_or(0);

    // Fifth pass: attempt to remap internal links to genre links where possible
    for node in &mut graph.nodes {
        if let Some(wikitext_description) = &mut node.wikitext_description {
            for node in wikitext_description.iter_mut() {
                node.visit_mut(&mut |node| {
                    if let SimplifiedWikitextNode::Link {
                        title, genre_id, ..
                    } = node
                    {
                        if let Some(page_data_id) = links_to_articles
                            .map(title)
                            .and_then(|page| page_to_id.get(&page))
                        {
                            *genre_id = Some(*page_data_id);
                        }
                    }
                });
            }
        }
    }

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
    // We use BIG SOLIDUS (⧸) as it's unlikely to be used in a page name
    // but still looks like a slash
    let mut output = title.name.clone();
    if let Some(heading) = &title.heading {
        output.push_str(&format!("#{heading}"));
    }
    output.replace("/", "⧸")
}

/// Reverses [`sanitize_page_name`].
fn unsanitize_page_name(title: &str) -> PageName {
    let output = title.replace("⧸", "/");
    if let Some((name, heading)) = output.split_once('#') {
        PageName {
            name: name.to_string(),
            heading: Some(heading.to_string()),
        }
    } else {
        PageName {
            name: output,
            heading: None,
        }
    }
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
