//! Loads the raw Wikipedia dump and extracts all pages with the infobox "music genre" and all redirects.
use std::{
    collections::{BTreeMap, BTreeSet},
    io::{BufRead as _, Write as _},
    path::{Path, PathBuf},
    sync::atomic::{AtomicUsize, Ordering},
};

use anyhow::Context;
use quick_xml::events::Event;
use rayon::iter::{IntoParallelRefIterator as _, ParallelIterator as _};
use serde::{Deserialize, Serialize};

use crate::{
    types::{Config, PageName},
    util,
};

/// A map of page names to their output file paths.
#[derive(Clone, Default)]
pub struct GenrePages(pub BTreeMap<PageName, PathBuf>);
impl GenrePages {
    /// Iterate over all genre pages.
    pub fn iter(&self) -> impl Iterator<Item = (&PageName, &PathBuf)> {
        self.0.iter()
    }
}

/// A map of musical artist page names to their output file paths.
#[derive(Clone, Default)]
pub struct ArtistPages(pub BTreeMap<PageName, PathBuf>);
impl ArtistPages {
    /// Iterate over all musical artist pages.
    pub fn iter(&self) -> impl Iterator<Item = (&PageName, &PathBuf)> {
        self.0.iter()
    }
}

/// All redirects on Wikipedia. Yes, all of them.
pub enum AllRedirects {
    /// All redirects in memory.
    InMemory(BTreeMap<PageName, PageName>),
    /// Redirects loaded from a file.
    LazyLoad(PathBuf, std::time::Instant),
}
impl TryFrom<AllRedirects> for BTreeMap<PageName, PageName> {
    type Error = anyhow::Error;
    fn try_from(value: AllRedirects) -> Result<Self, Self::Error> {
        match value {
            AllRedirects::InMemory(value) => Ok(value),
            AllRedirects::LazyLoad(path, start) => {
                let value = serde_json::from_slice(&std::fs::read(path)?)?;
                println!(
                    "{:.2}s: loaded all redirects",
                    start.elapsed().as_secs_f32()
                );
                Ok(value)
            }
        }
    }
}

/// The header placed atop an outputted wikitext file.
#[derive(Clone, Serialize, Deserialize)]
pub struct WikitextHeader {
    /// The timestamp of the page when it was last edited.
    pub timestamp: jiff::Timestamp,
    /// The ID of the page.
    pub id: u64,
}

/// Metadata about the Wikipedia dump.
#[derive(Clone, Serialize, Deserialize)]
pub struct DumpMeta {
    /// The name of the Wikipedia database.
    pub wikipedia_db_name: String,
    /// The domain of the Wikipedia instance.
    pub wikipedia_domain: String,
    /// The date of the Wikipedia dump.
    pub dump_date: jiff::civil::Date,
}

/// Result of extracting data from the Wikipedia dump.
pub struct ExtractedData {
    /// Metadata about the Wikipedia dump.
    pub dump_meta: DumpMeta,
    /// All genre pages extracted from the dump.
    pub genres: GenrePages,
    /// All musical artist pages extracted from the dump.
    pub artists: ArtistPages,
    /// All redirects found in the dump.
    pub redirects: AllRedirects,
    /// All Wikipedia page IDs to page names.
    pub id_to_page_names: BTreeMap<u64, PageName>,
}

/// Intermediate data collected during parallel processing.
#[derive(Clone, Default)]
struct IntermediateData {
    /// Genre pages found so far.
    genre_pages: BTreeMap<PageName, PathBuf>,
    /// Artist pages found so far.
    artist_pages: BTreeMap<PageName, PathBuf>,
    /// Redirects found so far.
    redirects: BTreeMap<PageName, PageName>,
    /// Page IDs to page names
    id_to_page_names: BTreeMap<u64, PageName>,
}
impl IntermediateData {
    /// Merge another intermediate data into this one.
    fn merge(&mut self, other: IntermediateData) {
        self.genre_pages.extend(other.genre_pages);
        self.artist_pages.extend(other.artist_pages);
        self.redirects.extend(other.redirects);
        self.id_to_page_names.extend(other.id_to_page_names);
    }
}

/// Given a Wikipedia dump, extract genres, musical artists, and all redirects.
///
/// We extract all redirects as we may need to resolve redirects to redirects.
pub fn from_data_dump(
    config: &Config,
    start: std::time::Instant,
    dump_date: jiff::civil::Date,
    output_path: &Path,
) -> anyhow::Result<ExtractedData> {
    // Construct paths from the output path
    let offsets_path = output_path.join("offsets.txt");
    let meta_path = output_path.join("meta.toml");
    let genres_path = output_path.join("genres");
    let artists_path = output_path.join("artists");
    let redirects_path = output_path.join("all_redirects.json");
    let id_to_page_names_path = output_path.join("id_to_page_names.json");

    // Already exists, just load from file
    if genres_path.is_dir()
        && artists_path.is_dir()
        && redirects_path.is_file()
        && id_to_page_names_path.is_file()
        && meta_path.is_file()
    {
        let meta = toml::from_str(&std::fs::read_to_string(&meta_path)?)?;

        let mut genre_pages = BTreeMap::default();
        for entry in std::fs::read_dir(&genres_path)? {
            let path = entry?.path();
            let Some(file_stem) = path.file_stem() else {
                continue;
            };
            genre_pages.insert(PageName::unsanitize(&file_stem.to_string_lossy()), path);
        }
        println!(
            "{:.2}s: loaded all {} genre pages",
            start.elapsed().as_secs_f32(),
            genre_pages.len()
        );

        let mut artist_pages = BTreeMap::default();
        for entry in std::fs::read_dir(&artists_path)? {
            let path = entry?.path();
            let Some(file_stem) = path.file_stem() else {
                continue;
            };
            artist_pages.insert(PageName::unsanitize(&file_stem.to_string_lossy()), path);
        }
        println!(
            "{:.2}s: loaded all {} artist pages",
            start.elapsed().as_secs_f32(),
            artist_pages.len()
        );

        let id_to_page_names =
            serde_json::from_str(&std::fs::read_to_string(&id_to_page_names_path)?)?;

        return Ok(ExtractedData {
            dump_meta: meta,
            genres: GenrePages(genre_pages),
            artists: ArtistPages(artist_pages),
            redirects: AllRedirects::LazyLoad(redirects_path, start),
            id_to_page_names,
        });
    }

    println!(
        "{:.2}s: extraction results missing; beginning extraction from Wikipedia dump",
        start.elapsed().as_secs_f32()
    );

    std::fs::create_dir_all(output_path).context("Failed to create output directory")?;

    // Load offsets to allow for multithreaded read
    let offsets = load_offsets(start, config, &offsets_path)?;

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
    let (wikipedia_domain, wikipedia_db_name) = extract_wikipedia_meta(&dump_file, &offsets)?;

    // Create directories for genres and artists
    std::fs::create_dir_all(&genres_path).context("Failed to create genres directory")?;
    std::fs::create_dir_all(&artists_path).context("Failed to create artists directory")?;

    // Iterate over each offset
    let artist_counter = AtomicUsize::new(0);
    let intermediate_data = offsets
        .par_iter()
        .fold(IntermediateData::default, |acc, offset| {
            process_offset_slice(
                &dump_file,
                &wikipedia_domain,
                &genres_path,
                &artists_path,
                &artist_counter,
                start,
                acc,
                offset,
            )
        })
        .reduce(IntermediateData::default, |mut acc, data| {
            acc.merge(data);
            acc
        });

    std::fs::write(
        &redirects_path,
        &serde_json::to_string_pretty(&intermediate_data.redirects)?,
    )
    .context("Failed to write redirects")?;

    std::fs::write(
        &id_to_page_names_path,
        &serde_json::to_string_pretty(&intermediate_data.id_to_page_names)?,
    )
    .context("Failed to write id_to_page_names")?;

    let meta = DumpMeta {
        wikipedia_domain,
        wikipedia_db_name,
        dump_date,
    };
    std::fs::write(&meta_path, toml::to_string_pretty(&meta)?).context("Failed to write meta")?;

    println!(
        "{:.2}s: extracted genres, artists, redirects and meta",
        start.elapsed().as_secs_f32()
    );

    Ok(ExtractedData {
        dump_meta: meta,
        genres: GenrePages(intermediate_data.genre_pages),
        artists: ArtistPages(intermediate_data.artist_pages),
        redirects: AllRedirects::InMemory(intermediate_data.redirects),
        id_to_page_names: intermediate_data.id_to_page_names,
    })
}

/// Load the offsets from the Wikipedia index file.
fn load_offsets(
    start: std::time::Instant,
    config: &Config,
    offsets_path: &Path,
) -> anyhow::Result<Vec<usize>> {
    if offsets_path.exists() {
        let offsets_str =
            std::fs::read_to_string(offsets_path).context("Failed to read offsets file")?;
        let offsets: Vec<usize> = offsets_str
            .lines()
            .map(|line| line.parse().unwrap())
            .collect();
        println!(
            "{:.2}s: loaded {} offsets from file",
            start.elapsed().as_secs_f32(),
            offsets.len(),
        );
        return Ok(offsets);
    }

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
    let mut file = std::fs::File::create(offsets_path).context("Failed to create offsets file")?;
    for offset in &offsets {
        writeln!(file, "{offset}").context("Failed to write offset to file")?;
    }
    println!(
        "{:.2}s: extracted {} offsets from index and saved to file",
        start.elapsed().as_secs_f32(),
        offsets.len(),
    );

    Ok(offsets)
}

/// Extract the Wikipedia domain and database name from the Wikipedia dump.
fn extract_wikipedia_meta(
    dump_file: &memmap2::Mmap,
    offsets: &[usize],
) -> anyhow::Result<(String, String)> {
    let first_slice = &dump_file[0..offsets[0]];
    let mut reader = quick_xml::reader::Reader::from_reader(std::io::BufReader::new(
        bzip2::bufread::BzDecoder::new(first_slice),
    ));
    reader.config_mut().trim_text(true);
    let mut buf = vec![];
    let mut wikipedia_domain: String = String::new();
    let mut recording_wikipedia_domain = false;
    let mut wikipedia_db_name: String = String::new();
    let mut recording_wikipedia_db_name = false;
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Eof) => break,
            Ok(Event::Start(e)) => {
                let name = e.name().0;
                if name == b"base" {
                    wikipedia_domain.clear();
                    recording_wikipedia_domain = true;
                } else if name == b"dbname" {
                    wikipedia_db_name.clear();
                    recording_wikipedia_db_name = true;
                }
            }
            Ok(Event::Text(e)) => {
                if recording_wikipedia_domain {
                    wikipedia_domain.push_str(&e.unescape().unwrap());
                } else if recording_wikipedia_db_name {
                    wikipedia_db_name.push_str(&e.unescape().unwrap());
                }
            }
            Ok(Event::End(e)) => {
                if e.name().0 == b"base" {
                    recording_wikipedia_domain = false;
                    wikipedia_domain = util::extract_domain(&wikipedia_domain)
                        .expect("wikipedia_domain could not be extracted")
                        .to_string();
                } else if e.name().0 == b"dbname" {
                    recording_wikipedia_db_name = false;
                }
            }
            _ => {}
        }
        buf.clear();
    }
    if wikipedia_domain.is_empty() {
        anyhow::bail!("Failed to extract Wikipedia domain from dump");
    }
    if wikipedia_db_name.is_empty() {
        anyhow::bail!("Failed to extract Wikipedia db name from dump");
    }
    Ok((wikipedia_domain, wikipedia_db_name))
}

/// Process a slice of the Wikipedia dump to extract its redirects, genres, and artists.
///
/// Returns the intermediate data collected during the processing.
#[allow(clippy::too_many_arguments)]
fn process_offset_slice(
    dump_file: &[u8],
    wikipedia_domain: &str,
    genres_path: &Path,
    artists_path: &Path,
    artist_counter: &AtomicUsize,
    start: std::time::Instant,
    mut data: IntermediateData,
    &offset: &usize,
) -> IntermediateData {
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

    // We have to special case how we detect IDs as there are multiple "ID" tags per page
    // (there's the page ID, and then there's the revision / contributor ID).
    //
    // We just take the first ID after the page tag.
    let mut page_id = String::new();
    let mut recording_page_id = false;

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
                } else if name == b"page" {
                    // Reset the page ID when we see a new page
                    page_id.clear();
                } else if name == b"id" && page_id.is_empty() {
                    // Don't start recording if we've already seen an ID
                    recording_page_id = true;
                }
            }
            Ok(Event::Text(e)) => {
                if recording_title {
                    title.push_str(&e.unescape().unwrap());
                } else if recording_text {
                    text.push_str(&e.unescape().unwrap());
                } else if recording_timestamp {
                    timestamp.push_str(&e.unescape().unwrap());
                } else if recording_page_id {
                    page_id.push_str(&e.unescape().unwrap());
                }
            }
            Ok(Event::End(e)) => {
                let tag_name = e.name().0;
                if tag_name == b"title" {
                    recording_title = false;
                } else if tag_name == b"text" {
                    recording_text = false;
                } else if tag_name == b"timestamp" {
                    recording_timestamp = false;
                } else if tag_name == b"id" {
                    recording_page_id = false;
                } else if tag_name == b"page" {
                    let page = PageName {
                        name: title.clone(),
                        heading: None,
                    };
                    if text.starts_with("#REDIRECT") {
                        // Parse the redirect and add it to the redirects map
                        match parse_redirect_text(wikipedia_domain, &text) {
                            Ok(redirect) => {
                                data.redirects.insert(page.clone(), redirect);
                            }
                            Err(e) => {
                                eprintln!("Warning: Failed to parse redirect for {page}: {e}");
                            }
                        }
                        continue;
                    }

                    let is_genre = text.contains("nfobox music genre");
                    let is_artist = text.contains("nfobox musical artist");

                    if !(is_genre || is_artist) {
                        continue;
                    }

                    // This is a genre or an artist page, so save it to disk
                    let (output_path, page_type, output_collection, counter) = if is_genre {
                        (&genres_path, "genre", &mut data.genre_pages, None)
                    } else {
                        let ac = artist_counter;
                        (&artists_path, "artist", &mut data.artist_pages, Some(ac))
                    };

                    // Skip pages with colons (namespace pages)
                    if page.name.contains(":") {
                        continue;
                    }

                    let timestamp = timestamp
                        .parse::<jiff::Timestamp>()
                        .with_context(|| {
                            format!("Failed to parse timestamp {timestamp} for {page}")
                        })
                        .unwrap();

                    let output_file_path =
                        output_path.join(format!("{}.wikitext", PageName::sanitize(&page)));
                    let output_file = std::fs::File::create(&output_file_path)
                        .with_context(|| format!("Failed to create output file for {page}"))
                        .unwrap();
                    let mut output_file = std::io::BufWriter::new(output_file);

                    let page_id = page_id
                        .parse()
                        .with_context(|| format!("Failed to parse ID {page_id} for {page}"))
                        .unwrap();

                    data.id_to_page_names.insert(page_id, page.clone());

                    writeln!(
                        output_file,
                        "{}",
                        serde_json::to_string(&WikitextHeader {
                            timestamp,
                            id: page_id,
                        })
                        .context("Failed to serialize WikitextHeader")
                        .unwrap()
                    )
                    .context("Failed to write header to output file")
                    .unwrap();

                    write!(output_file, "{text}")
                        .context("Failed to write text to output file")
                        .unwrap();

                    if let Some(counter) = counter {
                        let count = counter.fetch_add(1, Ordering::Relaxed) + 1;
                        if count % 5000 == 0 {
                            println!(
                                "{:.2}s: processed {count} {page_type}s",
                                start.elapsed().as_secs_f32()
                            );
                        }
                    } else {
                        println!("{:.2}s: {page_type} {page}", start.elapsed().as_secs_f32());
                    }

                    output_collection.insert(page.clone(), output_file_path);
                }
            }
            _ => {}
        }
        buf.clear();
    }

    data
}

#[derive(Debug)]
enum RedirectParseError {
    InvalidRedirect { text: String },
    ExternalLinkNotOnThisWiki { text: String },
}
impl std::fmt::Display for RedirectParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RedirectParseError::InvalidRedirect { text } => {
                write!(f, "Invalid redirect format: {text}")
            }
            RedirectParseError::ExternalLinkNotOnThisWiki { text } => {
                write!(f, "External link not on this wiki: {text}")
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

        let domain = util::extract_domain(url).ok_or_else(|| {
            RedirectParseError::ExternalLinkNotOnThisWiki {
                text: text.to_string(),
            }
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
mod tests {
    use super::*;

    const WIKIPEDIA_DOMAIN: &str = "en.wikipedia.org";

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
