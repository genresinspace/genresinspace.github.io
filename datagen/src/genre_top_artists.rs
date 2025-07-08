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
) -> anyhow::Result<HashMap<types::PageName, Vec<(types::ArtistName, usize)>>> {
    if output_path.exists() {
        return Ok(serde_json::from_slice(
            &std::fs::read(output_path).context("Failed to read genre top artists")?,
        )
        .context("Failed to parse genre top artists")?);
    }

    println!(
        "{:.2}s: calculating genre top artists",
        start.elapsed().as_secs_f32(),
    );

    let mut result = HashMap::<types::PageName, Vec<(types::ArtistName, usize)>>::new();

    for (artist_page, artist) in &processed_artists.0 {
        for genre in &artist.genres {
            let Some(page_name) = links_to_articles.map(&genre) else {
                continue;
            };
            result.entry(page_name).or_default().push((
                artist.name.clone(),
                artist_inbound_link_counts
                    .get(&artist_page)
                    .copied()
                    .unwrap_or(0),
            ));
        }
    }

    for artists in result.values_mut() {
        artists.sort_by_key(|(_, count)| *count);
        artists.reverse();
    }

    std::fs::write(output_path, serde_json::to_string_pretty(&result)?)?;

    println!(
        "{:.2}s: wrote genre top artists",
        start.elapsed().as_secs_f32(),
    );

    Ok(result)
}
