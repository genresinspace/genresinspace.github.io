//! Serialization types and paths for the frontend data.json file.
//!
//! These are shared between the main datagen pipeline and the `relayout` binary.

use std::collections::BTreeSet;
use std::path::Path;

/// Path to the website public directory (output root), relative to the repo root.
pub const WEBSITE_PUBLIC_PATH: &str = "website/public";

/// Path to `data.json` relative to the repository root.
pub fn data_json_path() -> &'static Path {
    Path::new("website/public/data.json")
}

use serde::{Deserialize, Serialize, ser::SerializeTuple};

use crate::types::{GenreName, PageDataId};

/// The root structure serialized to `data.json`.
#[derive(Debug, Serialize, Deserialize)]
pub struct FrontendData {
    /// The Wikipedia domain (e.g. "en.wikipedia.org").
    pub wikipedia_domain: String,
    /// The Wikipedia database name (e.g. "enwiki").
    pub wikipedia_db_name: String,
    /// The dump date (e.g. "2026-02-01").
    pub dump_date: String,
    /// The graph nodes.
    pub nodes: Vec<NodeData>,
    /// The graph edges.
    pub edges: BTreeSet<EdgeData>,
    /// The maximum degree of any node.
    pub max_degree: usize,
}

/// A genre node in the graph.
#[derive(Debug, Serialize, Deserialize)]
pub struct NodeData {
    /// The Wikipedia page title, if different from the label.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_title: Option<String>,
    /// The display label.
    pub label: GenreName,
    /// X position from force-directed layout.
    pub x: f64,
    /// Y position from force-directed layout.
    pub y: f64,
    /// Hue (0–360) from color propagation.
    #[serde(default)]
    pub hue: f64,
}

/// The type of relationship between two genres.
#[derive(Debug, Serialize, Deserialize, Hash, PartialEq, Eq, PartialOrd, Ord)]
pub enum EdgeType {
    /// A derivative genre relationship.
    Derivative,
    /// A subgenre relationship.
    Subgenre,
    /// A fusion genre relationship.
    FusionGenre,
}

/// An edge between two genre nodes, serialized as a `[source, target, type]` tuple.
#[derive(Debug, Hash, PartialEq, Eq, PartialOrd, Ord)]
pub struct EdgeData {
    /// The source node ID.
    pub source: PageDataId,
    /// The target node ID.
    pub target: PageDataId,
    /// The edge type.
    pub ty: EdgeType,
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

impl<'de> Deserialize<'de> for EdgeData {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let (source, target, ty): (PageDataId, PageDataId, u8) =
            Deserialize::deserialize(deserializer)?;
        let ty = match ty {
            0 => EdgeType::Derivative,
            1 => EdgeType::Subgenre,
            2 => EdgeType::FusionGenre,
            _ => return Err(serde::de::Error::custom(format!("unknown edge type: {ty}"))),
        };
        Ok(EdgeData { source, target, ty })
    }
}
