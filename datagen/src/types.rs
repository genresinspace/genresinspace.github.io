//! Types used throughout the program that are not specific to any stage.
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

pub use shared::PageName;

#[derive(Debug, Deserialize)]
/// The configuration for the program.
pub struct Config {
    /// The path to the Wikipedia dump.
    pub wikipedia_dump_path: PathBuf,
    /// The path to the Wikipedia index.
    pub wikipedia_index_path: PathBuf,
    /// The path to the Wikipedia link targets SQL dump.
    pub wikipedia_linktargets_path: PathBuf,
    /// The path to the Wikipedia links SQL dump.
    pub wikipedia_links_path: PathBuf,
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

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Hash)]
/// A newtype for an artist name.
pub struct ArtistName(pub String);
impl std::fmt::Display for ArtistName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "artist:{}", self.0)
    }
}
