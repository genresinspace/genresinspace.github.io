//! Calculate the top artists for each genre.
use std::{
    collections::{BTreeMap, BTreeSet},
    path::Path,
};

use anyhow::Context as _;

use crate::{links, process, types};

/// A map of genre page names to their top artists.
pub type GenreTopArtists = BTreeMap<types::PageName, Vec<(types::PageName, f32)>>;

/// A map of artist page names to their genres.
pub type ArtistGenres = BTreeMap<types::PageName, BTreeSet<types::PageName>>;

/// Calculate the top artists for each genre.
pub fn calculate(
    start: std::time::Instant,
    processed_artists: &process::ProcessedArtists,
    artist_inbound_link_counts: &BTreeMap<types::PageName, usize>,
    links_to_articles: &links::LinksToArticles,
    output_path_gta: &Path,
    output_path_ag: &Path,
) -> anyhow::Result<(GenreTopArtists, ArtistGenres)> {
    if output_path_gta.exists() && output_path_ag.exists() {
        println!(
            "{:.2}s: loading genre top artists and artist genres",
            start.elapsed().as_secs_f32(),
        );
        return Ok((
            serde_json::from_slice(
                &std::fs::read(output_path_gta).context("Failed to read genre top artists")?,
            )
            .context("Failed to parse genre top artists")?,
            serde_json::from_slice(
                &std::fs::read(output_path_ag).context("Failed to read artist genres")?,
            )
            .context("Failed to parse artist genres")?,
        ));
    }

    println!(
        "{:.2}s: calculating genre top artists",
        start.elapsed().as_secs_f32(),
    );

    let mut intermediate_gta = BTreeMap::<types::PageName, BTreeMap<types::PageName, f32>>::new();
    let mut artist_genres = ArtistGenres::new();

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

            *intermediate_gta
                .entry(page_name.clone())
                .or_default()
                .entry(artist_page.clone())
                .or_default() += weighted_score;

            artist_genres
                .entry(artist_page.clone())
                .or_default()
                .insert(page_name);
        }
    }

    let mut gta: BTreeMap<types::PageName, Vec<(types::PageName, f32)>> = intermediate_gta
        .into_iter()
        .map(|(genre, artists)| (genre, artists.into_iter().collect::<Vec<_>>()))
        .collect();

    for artists in gta.values_mut() {
        artists.sort_by(|(page_a, score_a), (page_b, score_b)| {
            let score_cmp = score_b.partial_cmp(score_a).unwrap();
            if score_cmp == std::cmp::Ordering::Equal {
                page_a.cmp(page_b)
            } else {
                score_cmp
            }
        });
    }

    std::fs::write(output_path_gta, serde_json::to_string_pretty(&gta)?)?;
    std::fs::write(
        output_path_ag,
        serde_json::to_string_pretty(&artist_genres)?,
    )?;

    println!(
        "{:.2}s: wrote genre top artists and artist genres",
        start.elapsed().as_secs_f32(),
    );

    Ok((gta, artist_genres))
}
