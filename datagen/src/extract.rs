//! Loads the raw Wikipedia dump and extracts all pages with the infobox "music genre" and all redirects.
use std::{
    collections::{BTreeSet, HashMap},
    io::{BufRead as _, Write as _},
    path::{Path, PathBuf},
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
pub struct GenrePages(pub HashMap<PageName, PathBuf>);
impl GenrePages {
    /// Iterate over all genre pages.
    pub fn iter(&self) -> impl Iterator<Item = (&PageName, &PathBuf)> {
        self.0.iter()
    }
}

/// All redirects on Wikipedia. Yes, all of them.
pub enum AllRedirects {
    /// All redirects in memory.
    InMemory(HashMap<PageName, PageName>),
    /// Redirects loaded from a file.
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

/// The header placed atop an outputted wikitext file.
#[derive(Clone, Serialize, Deserialize)]
pub struct WikitextHeader {
    /// The timestamp of the page when it was last edited.
    pub timestamp: jiff::Timestamp,
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

/// Given a Wikipedia dump, extract genres and all redirects.
///
/// We extract all redirects as we may need to resolve redirects to redirects.
pub fn genres_and_all_redirects(
    config: &Config,
    start: std::time::Instant,
    dump_date: jiff::civil::Date,
    offsets_path: &Path,
    meta_path: &Path,
    genres_path: &Path,
    redirects_path: &Path,
) -> anyhow::Result<(DumpMeta, GenrePages, AllRedirects)> {
    // Already exists, just load from file
    if genres_path.is_dir() && redirects_path.is_file() && meta_path.is_file() {
        let mut genre_pages = HashMap::default();
        for entry in std::fs::read_dir(genres_path)? {
            let path = entry?.path();
            let Some(file_stem) = path.file_stem() else {
                continue;
            };
            genre_pages.insert(PageName::unsanitize(&file_stem.to_string_lossy()), path);
        }
        println!(
            "{:.2}s: loaded all {} pages",
            start.elapsed().as_secs_f32(),
            genre_pages.len()
        );

        let meta = toml::from_str(&std::fs::read_to_string(meta_path)?)?;

        return Ok((
            meta,
            GenrePages(genre_pages),
            AllRedirects::LazyLoad(redirects_path.to_owned(), start),
        ));
    }

    println!(
        "Genres directory or redirects file or meta does not exist, extracting from Wikipedia dump"
    );
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
    let (wikipedia_domain, wikipedia_db_name) = {
        let mut reader = quick_xml::reader::Reader::from_reader(std::io::BufReader::new(
            bzip2::bufread::BzDecoder::new(&dump_file[0..offsets[0]]),
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

        (wikipedia_domain, wikipedia_db_name)
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
                                        .join(format!("{}.wikitext", PageName::sanitize(&page)));
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

    let meta = DumpMeta {
        wikipedia_domain,
        wikipedia_db_name,
        dump_date,
    };
    std::fs::write(meta_path, toml::to_string_pretty(&meta)?).context("Failed to write meta")?;

    println!(
        "Extracted genres and redirects and meta in {:?}",
        now.elapsed()
    );

    Ok((
        meta,
        GenrePages(genre_pages),
        AllRedirects::InMemory(all_redirects),
    ))
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
