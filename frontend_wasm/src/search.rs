//! Fuzzy genre search with externally-tunable ranking.
//!
//! The index is built once from node labels, aliases, and inbound link counts;
//! every query is scored against all entries with weights supplied per call,
//! so ranking can be tuned from JS without recompiling.

use serde::{Deserialize, Serialize};
use tsify_next::Tsify;
use wasm_bindgen::prelude::*;

/// Ranking weights for a search. All fields are optional from JS; missing
/// fields take the defaults documented here.
#[derive(Debug, Clone, Deserialize, Tsify)]
#[tsify(from_wasm_abi)]
#[serde(rename_all = "camelCase", default)]
pub struct SearchParams {
    /// Score for an exact (whole-string) match.
    #[tsify(optional)]
    pub exact_weight: f64,
    /// Score for a match at the start of the string.
    #[tsify(optional)]
    pub prefix_weight: f64,
    /// Score for a match at the start of a word.
    #[tsify(optional)]
    pub word_boundary_weight: f64,
    /// Score for a match anywhere in the string.
    #[tsify(optional)]
    pub substring_weight: f64,
    /// Score for a non-contiguous (subsequence) match.
    #[tsify(optional)]
    pub subsequence_weight: f64,
    /// Multiplier (< 1.0) applied when the best match is an alias rather than
    /// the genre's label.
    #[tsify(optional)]
    pub alias_penalty: f64,
    /// Additive popularity bonus: `popularity_weight * ln(1+links) / ln(1+max_links)`.
    #[tsify(optional)]
    pub popularity_weight: f64,
    /// Maximum number of results to return.
    #[tsify(optional)]
    pub limit: usize,
}
impl Default for SearchParams {
    fn default() -> Self {
        Self {
            exact_weight: 1000.0,
            prefix_weight: 500.0,
            word_boundary_weight: 250.0,
            substring_weight: 100.0,
            subsequence_weight: 25.0,
            alias_penalty: 0.8,
            popularity_weight: 50.0,
            limit: 10,
        }
    }
}

/// A single search hit.
#[derive(Debug, Clone, Serialize, Tsify)]
#[tsify(into_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    /// Node id as a stringified index into the node array the searcher was
    /// constructed from — matches the frontend's `NodeData.id`.
    pub id: String,
    pub score: f64,
    /// The text that matched: the label, or the alias that matched.
    pub matched_text: String,
    /// True when `matched_text` is an alias rather than the label.
    pub is_alias: bool,
    /// Match spans within `matched_text`, in UTF-16 code units (directly
    /// usable with JS `String.slice`).
    pub spans: Vec<MatchSpan>,
}

/// A half-open range of UTF-16 code units.
#[derive(Debug, Clone, Copy, Serialize, Tsify)]
pub struct MatchSpan {
    pub start: u32,
    pub end: u32,
}

struct IndexEntry {
    node_index: u32,
    /// Original display text.
    text: String,
    /// `shared::normalize_search_text(text)`.
    normalized: String,
    /// For each byte of `normalized`, the UTF-16 range in `text` of the
    /// original character that produced it (start at `[i].0`, end at `[i].1`).
    utf16_map: Vec<(u32, u32)>,
    is_alias: bool,
    popularity_ln: f64,
}

/// A search index over genre labels and aliases.
pub struct SearchIndex {
    entries: Vec<IndexEntry>,
    node_count: usize,
    max_popularity_ln: f64,
}

/// A scored match of one index entry, with byte spans into its `normalized` text.
struct Candidate {
    score: f64,
    entry_index: usize,
    spans: Vec<(usize, usize)>,
}

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum MatchTier {
    Subsequence,
    Substring,
    WordBoundary,
    Prefix,
    Exact,
}

impl SearchIndex {
    /// Build an index from `(label, aliases, inbound_link_count)` per node, in
    /// node order.
    pub fn new(nodes: impl IntoIterator<Item = (String, Vec<String>, usize)>) -> Self {
        let mut entries = Vec::new();
        let mut node_count = 0;
        let mut max_popularity_ln = 0.0f64;
        for (node_index, (label, aliases, links)) in nodes.into_iter().enumerate() {
            node_count += 1;
            let popularity_ln = (1.0 + links as f64).ln();
            max_popularity_ln = max_popularity_ln.max(popularity_ln);
            entries.push(IndexEntry::new(
                node_index as u32,
                label,
                false,
                popularity_ln,
            ));
            for alias in aliases {
                entries.push(IndexEntry::new(
                    node_index as u32,
                    alias,
                    true,
                    popularity_ln,
                ));
            }
        }
        Self {
            entries,
            node_count,
            max_popularity_ln,
        }
    }

    pub fn search(&self, query: &str, params: &SearchParams) -> Vec<SearchResult> {
        let normalized_query = shared::normalize_search_text(query);
        if normalized_query.chars().count() < 2 {
            return vec![];
        }

        // Best-scoring entry per node.
        let mut best: Vec<Option<Candidate>> = std::iter::repeat_with(|| None)
            .take(self.node_count)
            .collect();
        for (entry_index, entry) in self.entries.iter().enumerate() {
            let Some((tier, spans)) = entry.match_query(&normalized_query) else {
                continue;
            };
            let tier_weight = match tier {
                MatchTier::Exact => params.exact_weight,
                MatchTier::Prefix => params.prefix_weight,
                MatchTier::WordBoundary => params.word_boundary_weight,
                MatchTier::Substring => params.substring_weight,
                MatchTier::Subsequence => params.subsequence_weight,
            };
            // Compactness: matching more of the entry's text scores higher.
            let compactness = 1.0
                + 0.5 * normalized_query.chars().count() as f64
                    / entry.normalized.chars().count().max(1) as f64;
            let alias_factor = if entry.is_alias {
                params.alias_penalty
            } else {
                1.0
            };
            let popularity = if self.max_popularity_ln > 0.0 {
                params.popularity_weight * entry.popularity_ln / self.max_popularity_ln
            } else {
                0.0
            };
            let score = tier_weight * compactness * alias_factor + popularity;

            let slot = &mut best[entry.node_index as usize];
            let replace = match slot {
                None => true,
                // Prefer the label over an alias on equal scores.
                Some(existing) => {
                    score > existing.score
                        || (score == existing.score
                            && self.entries[existing.entry_index].is_alias
                            && !entry.is_alias)
                }
            };
            if replace {
                *slot = Some(Candidate {
                    score,
                    entry_index,
                    spans,
                });
            }
        }

        let mut hits: Vec<Candidate> = best.into_iter().flatten().collect();
        hits.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| {
                    self.entries[a.entry_index]
                        .text
                        .cmp(&self.entries[b.entry_index].text)
                })
        });
        hits.truncate(params.limit);

        hits.into_iter()
            .map(|candidate| {
                let entry = &self.entries[candidate.entry_index];
                SearchResult {
                    id: entry.node_index.to_string(),
                    score: candidate.score,
                    matched_text: entry.text.clone(),
                    is_alias: entry.is_alias,
                    spans: entry.spans_to_utf16(&candidate.spans),
                }
            })
            .collect()
    }
}

impl IndexEntry {
    fn new(node_index: u32, text: String, is_alias: bool, popularity_ln: f64) -> Self {
        let mut normalized = String::new();
        let mut utf16_map = Vec::new();
        let mut utf16_offset = 0u32;
        for c in text.chars() {
            let utf16_len = c.len_utf16() as u32;
            let normalized_char = shared::normalize_search_text(&c.to_string());
            for _ in 0..normalized_char.len() {
                utf16_map.push((utf16_offset, utf16_offset + utf16_len));
            }
            normalized.push_str(&normalized_char);
            utf16_offset += utf16_len;
        }
        Self {
            node_index,
            text,
            normalized,
            utf16_map,
            is_alias,
            popularity_ln,
        }
    }

    /// Match a normalized query against this entry, returning the best tier
    /// and the matched byte ranges within `self.normalized`.
    fn match_query(&self, query: &str) -> Option<(MatchTier, Vec<(usize, usize)>)> {
        if self.normalized == query {
            return Some((MatchTier::Exact, vec![(0, self.normalized.len())]));
        }
        if let Some(position) = self.normalized.find(query) {
            let tier = if position == 0 {
                MatchTier::Prefix
            } else if self.is_word_boundary(position)
                || self
                    .normalized
                    .match_indices(query)
                    .any(|(p, _)| self.is_word_boundary(p))
            {
                MatchTier::WordBoundary
            } else {
                MatchTier::Substring
            };
            // For the word-boundary tier, span the first boundary-aligned occurrence.
            let position = if tier == MatchTier::WordBoundary {
                self.normalized
                    .match_indices(query)
                    .find(|(p, _)| self.is_word_boundary(*p))
                    .map(|(p, _)| p)
                    .unwrap_or(position)
            } else {
                position
            };
            return Some((tier, vec![(position, position + query.len())]));
        }
        self.match_subsequence(query)
            .map(|spans| (MatchTier::Subsequence, spans))
    }

    /// True when the character before `position` is not alphanumeric.
    fn is_word_boundary(&self, position: usize) -> bool {
        self.normalized[..position]
            .chars()
            .next_back()
            .is_some_and(|c| !c.is_alphanumeric())
    }

    /// Greedy in-order subsequence match; returns contiguous byte runs.
    fn match_subsequence(&self, query: &str) -> Option<Vec<(usize, usize)>> {
        let mut spans: Vec<(usize, usize)> = Vec::new();
        let mut query_chars = query.chars().peekable();
        for (position, c) in self.normalized.char_indices() {
            let Some(&next) = query_chars.peek() else {
                break;
            };
            if c == next {
                query_chars.next();
                let end = position + c.len_utf8();
                match spans.last_mut() {
                    Some(last) if last.1 == position => last.1 = end,
                    _ => spans.push((position, end)),
                }
            }
        }
        query_chars.peek().is_none().then_some(spans)
    }

    /// Map byte ranges in `normalized` to UTF-16 ranges in `text`.
    fn spans_to_utf16(&self, spans: &[(usize, usize)]) -> Vec<MatchSpan> {
        spans
            .iter()
            .filter(|(start, end)| end > start && *end <= self.utf16_map.len())
            .map(|&(start, end)| MatchSpan {
                start: self.utf16_map[start].0,
                end: self.utf16_map[end - 1].1,
            })
            .collect()
    }
}

/// A node passed to [`GenreSearcher::new`].
#[derive(Debug, Deserialize, Tsify)]
#[tsify(from_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct SearcherNode {
    pub label: String,
    #[serde(default)]
    #[tsify(optional)]
    pub aliases: Vec<String>,
    #[serde(default)]
    #[tsify(optional)]
    pub links: usize,
}

/// Genre search over labels and aliases, weighted by popularity.
#[wasm_bindgen]
pub struct GenreSearcher {
    index: SearchIndex,
}

#[wasm_bindgen]
impl GenreSearcher {
    /// `nodes` must be in `data.nodes` order; result ids are indices into it.
    #[wasm_bindgen(constructor)]
    pub fn new(nodes: Vec<SearcherNode>) -> GenreSearcher {
        console_error_panic_hook::set_once();
        GenreSearcher {
            index: SearchIndex::new(
                nodes
                    .into_iter()
                    .map(|node| (node.label, node.aliases, node.links)),
            ),
        }
    }

    pub fn search(&self, query: &str, params: Option<SearchParams>) -> Vec<SearchResult> {
        self.index.search(query, &params.unwrap_or_default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn index(nodes: &[(&str, &[&str], usize)]) -> SearchIndex {
        SearchIndex::new(nodes.iter().map(|(label, aliases, links)| {
            (
                label.to_string(),
                aliases.iter().map(|a| a.to_string()).collect(),
                *links,
            )
        }))
    }

    fn ids(results: &[SearchResult]) -> Vec<&str> {
        results.iter().map(|r| r.id.as_str()).collect::<Vec<_>>()
    }

    #[test]
    fn tier_ordering() {
        let idx = index(&[
            ("Post-rock", &[], 0),    // word boundary
            ("Rockabilly", &[], 0),   // prefix
            ("Rock", &[], 0),         // exact
            ("Krautrock", &[], 0),    // substring
            ("Romantic ska", &[], 0), // subsequence (R, o, c of "romantic", k of "ska")
        ]);
        let results = idx.search("rock", &SearchParams::default());
        assert_eq!(ids(&results), ["2", "1", "0", "3", "4"]);
    }

    #[test]
    fn diacritics_are_insensitive() {
        let idx = index(&[("Pixadão", &[], 0)]);
        let results = idx.search("pixadao", &SearchParams::default());
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].matched_text, "Pixadão");
    }

    #[test]
    fn alias_match_reports_alias() {
        let idx = index(&[("Hip-hop", &["Rap music", "Rap"][..], 100)]);
        let results = idx.search("rap", &SearchParams::default());
        assert_eq!(results.len(), 1);
        assert!(results[0].is_alias);
        // "Rap" (exact) outranks "Rap music" (prefix).
        assert_eq!(results[0].matched_text, "Rap");
    }

    #[test]
    fn label_preferred_over_alias_on_tie() {
        let idx = index(&[("Rap", &["Rap"][..], 0)]);
        let results = idx.search("rap", &SearchParams::default());
        assert_eq!(results.len(), 1);
        assert!(!results[0].is_alias);
    }

    #[test]
    fn popularity_breaks_ties() {
        let idx = index(&[("House A", &[], 1), ("House B", &[], 1000)]);
        let results = idx.search("house", &SearchParams::default());
        assert_eq!(ids(&results), ["1", "0"]);
    }

    #[test]
    fn zero_popularity_everywhere_is_safe() {
        let idx = index(&[("Rock", &[], 0), ("Rocksteady", &[], 0)]);
        let results = idx.search("rock", &SearchParams::default());
        assert_eq!(results.len(), 2);
        assert!(results.iter().all(|r| r.score.is_finite()));
    }

    #[test]
    fn subsequence_matches() {
        let idx = index(&[("Drum and bass", &[], 0)]);
        let results = idx.search("dnb", &SearchParams::default());
        assert_eq!(results.len(), 1);
        // d, n (of "and"), b (of "bass")
        assert_eq!(results[0].spans.len(), 3);
    }

    #[test]
    fn spans_are_utf16_offsets_in_original_text() {
        let idx = index(&[("Pixadão funk", &[], 0)]);
        let results = idx.search("pixadao", &SearchParams::default());
        let spans = &results[0].spans;
        assert_eq!(spans.len(), 1);
        assert_eq!((spans[0].start, spans[0].end), (0, 7));
        // And a non-BMP-free multi-byte case mid-string:
        let idx = index(&[("Yé-yé pop", &[], 0)]);
        let results = idx.search("pop", &SearchParams::default());
        let spans = &results[0].spans;
        assert_eq!((spans[0].start, spans[0].end), (6, 9));
    }

    #[test]
    fn limit_is_respected() {
        let nodes: Vec<(String, Vec<String>, usize)> =
            (0..50).map(|i| (format!("Rock {i}"), vec![], 0)).collect();
        let idx = SearchIndex::new(nodes);
        let params = SearchParams {
            limit: 5,
            ..Default::default()
        };
        assert_eq!(idx.search("rock", &params).len(), 5);
    }

    #[test]
    fn short_queries_return_nothing() {
        let idx = index(&[("Rock", &[], 0)]);
        assert!(idx.search("r", &SearchParams::default()).is_empty());
        assert!(idx.search("", &SearchParams::default()).is_empty());
        assert!(idx.search(" ", &SearchParams::default()).is_empty());
    }
}
