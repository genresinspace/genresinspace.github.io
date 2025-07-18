//! Calculate the top artists for each genre.
use std::{collections::HashMap, path::Path};

use anyhow::Context as _;

use crate::{links, process, types};

/// Calculate the top artists for each genre.
pub fn calculate(
    start: std::time::Instant,
    processed_artists: &process::ProcessedArtists,
    artist_inbound_link_counts: &HashMap<types::PageName, usize>,
    links_to_articles: &links::LinksToArticles,
    output_path: &Path,
) -> anyhow::Result<HashMap<types::PageName, Vec<(types::PageName, f32)>>> {
    if output_path.exists() {
        println!(
            "{:.2}s: loading genre top artists",
            start.elapsed().as_secs_f32(),
        );
        return serde_json::from_slice(
            &std::fs::read(output_path).context("Failed to read genre top artists")?,
        )
        .context("Failed to parse genre top artists");
    }

    println!(
        "{:.2}s: calculating genre top artists",
        start.elapsed().as_secs_f32(),
    );

    let mut intermediate_result = HashMap::<types::PageName, HashMap<types::PageName, f32>>::new();

    for (artist_page, artist) in &processed_artists.0 {
        let link_count = artist_inbound_link_counts
            .get(artist_page)
            .copied()
            .unwrap_or(0) as f32;

        for (genre_index, genre) in artist.genres.iter().enumerate() {
            let Some(page_name) = links_to_articles.map(genre) else {
                continue;
            };

            // Calculate weight based on genre position
            // First genre gets full weight (1.0), last genre gets minimal weight (0.1)
            // Use exponential decay: weight = 0.1 + 0.9 * (0.5 ^ (index / (total_genres - 1)))
            let total_genres = artist.genres.len();
            let weight = if total_genres == 1 {
                1.0
            } else {
                let normalized_index = genre_index as f32 / (total_genres - 1) as f32;
                0.1 + 0.9 * (0.5_f32.powf(normalized_index))
            };

            let weighted_score = link_count * weight;

            *intermediate_result
                .entry(page_name)
                .or_default()
                .entry(artist_page.clone())
                .or_default() += weighted_score;
        }
    }

    let mut result: HashMap<types::PageName, Vec<(types::PageName, f32)>> = intermediate_result
        .into_iter()
        .map(|(genre, artists)| (genre, artists.into_iter().collect::<Vec<_>>()))
        .collect();

    for artists in result.values_mut() {
        artists.sort_by(|(_, score_a), (_, score_b)| score_b.partial_cmp(score_a).unwrap());
    }

    std::fs::write(output_path, serde_json::to_string_pretty(&result)?)?;

    println!(
        "{:.2}s: wrote genre top artists",
        start.elapsed().as_secs_f32(),
    );

    Ok(result)
}
