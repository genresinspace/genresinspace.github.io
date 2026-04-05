//! Types used throughout the program that are not specific to any stage.
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

pub use shared::PageName;

#[derive(Debug, Deserialize)]
/// The configuration for the program.
pub struct Config {
    /// The directory containing Wikipedia dump files.
    pub wikipedia_dump_dir: PathBuf,
    /// The YouTube API key.
    pub youtube_api_key: String,
}

/// Resolved paths to Wikipedia dump files within the dump directory.
pub struct WikipediaPaths {
    /// The path to the Wikipedia articles dump (*.xml.bz2).
    pub dump_path: PathBuf,
    /// The path to the Wikipedia index (*-index.txt.bz2).
    pub index_path: PathBuf,
    /// The path to the Wikipedia link targets SQL dump (*-linktarget.sql.gz).
    pub linktargets_path: PathBuf,
    /// The path to the Wikipedia links SQL dump (*-pagelinks.sql.gz).
    pub links_path: PathBuf,
}

impl Config {
    /// Resolve Wikipedia dump file paths by scanning the dump directory for known suffixes.
    pub fn resolve_wikipedia_paths(&self) -> anyhow::Result<WikipediaPaths> {
        let dir = &self.wikipedia_dump_dir;
        anyhow::ensure!(dir.is_dir(), "wikipedia_dump_dir {dir:?} is not a directory");

        /// Find exactly one file in `dir` whose name ends with `suffix`.
        fn find(dir: &Path, suffix: &str) -> anyhow::Result<PathBuf> {
            let mut found = None;
            for entry in std::fs::read_dir(dir)? {
                let entry = entry?;
                let name = entry.file_name();
                let name = name.to_string_lossy();
                if name.ends_with(suffix) {
                    anyhow::ensure!(
                        found.is_none(),
                        "multiple files matching *{suffix} in {dir:?}"
                    );
                    found = Some(entry.path());
                }
            }
            found.ok_or_else(|| anyhow::anyhow!("no file matching *{suffix} in {dir:?}"))
        }

        Ok(WikipediaPaths {
            dump_path: find(dir, "-pages-articles-multistream.xml.bz2")?,
            index_path: find(dir, "-pages-articles-multistream-index.txt.bz2")?,
            linktargets_path: find(dir, "-linktarget.sql.gz")?,
            links_path: find(dir, "-pagelinks.sql.gz")?,
        })
    }
}

/// A newtype for an ID assigned to a page for the graph.
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct PageDataId(pub usize);
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

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Hash)]
/// A newtype for an artist name.
pub struct ArtistName(pub String);
impl std::fmt::Display for ArtistName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "artist:{}", self.0)
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
/// A mix for a genre, consisting of a playlist or a video.
pub enum GenreMix {
    /// A playlist mix.
    Playlist {
        /// The ID of the playlist.
        playlist: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        /// A note about the mix.
        note: Option<String>,
    },
    /// A video mix.
    Video {
        /// The ID of the video.
        video: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        /// A note about the mix.
        note: Option<String>,
    },
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
/// A list of mixes for a genre.
pub enum GenreMixes {
    /// A mix was not available; this is why.
    Help {
        /// The reason the mix was not available.
        help_reason: Option<String>,
    },
    /// A list of mixes.
    Mixes(Vec<GenreMix>),
}
impl GenreMixes {
    /// Parse a list of mixes from a string.
    pub fn parse(input: &str) -> Self {
        let input = input.trim();

        if let Some(help_reason) = input.strip_prefix("help:") {
            return GenreMixes::Help {
                help_reason: Some(help_reason.trim().to_string()),
            };
        } else if input.trim() == "help" {
            return GenreMixes::Help { help_reason: None };
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
                    .next_back()
                    .map(|s| s.split(['&', '#']).next().unwrap().to_string())
            } else {
                None
            }
        }

        GenreMixes::Mixes(mixes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_help() {
        assert_eq!(
            GenreMixes::parse("help: not ready"),
            GenreMixes::Help {
                help_reason: Some("not ready".to_string())
            }
        );
        assert_eq!(
            GenreMixes::parse("help"),
            GenreMixes::Help { help_reason: None }
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
