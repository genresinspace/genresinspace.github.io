//! Types used throughout the program that are not specific to any stage.
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
/// The configuration for the program.
pub struct Config {
    /// The path to the Wikipedia dump.
    pub wikipedia_dump_path: PathBuf,
    /// The path to the Wikipedia index.
    pub wikipedia_index_path: PathBuf,
}

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
/// A newtype for a Wikipedia page name.
pub struct PageName {
    /// The name of the page.
    pub name: String,
    /// The heading of the page, if any.
    pub heading: Option<String>,
}
impl PageName {
    /// Create a new page name.
    pub fn new(name: impl Into<String>, heading: impl Into<Option<String>>) -> Self {
        Self {
            name: name.into(),
            heading: heading.into(),
        }
    }

    /// Set the heading of the page (for cases where the genre box is under a heading, not the root of the page)
    pub fn with_opt_heading(&self, heading: Option<String>) -> Self {
        Self {
            name: self.name.clone(),
            heading,
        }
    }

    /// Creates a variant of the page name that can be used for a link.
    pub fn linksafe(&self) -> Self {
        Self {
            name: self.name.replace(' ', "_"),
            heading: self.heading.clone(),
        }
    }

    /// Makes a Wikipedia page name safe to store on disk.
    pub fn sanitize(&self) -> String {
        // We use BIG SOLIDUS (⧸) as it's unlikely to be used in a page name
        // but still looks like a slash
        let mut output = self.name.clone();
        if let Some(heading) = &self.heading {
            output.push_str(&format!("#{heading}"));
        }
        output.replace("/", "⧸")
    }

    /// Reverses [`Self::sanitize`].
    pub fn unsanitize(title: &str) -> PageName {
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
