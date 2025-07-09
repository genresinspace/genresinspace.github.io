//! Resolves links to articles and builds a map of links to page names.
use std::{collections::HashMap, path::Path};

use anyhow::Context as _;

use crate::{extract, process, types::PageName};

/// A map of links to page names.
pub struct LinksToArticles(pub HashMap<String, PageName>);
impl LinksToArticles {
    /// Get the page name for a link.
    pub fn map(&self, link: &str) -> Option<PageName> {
        self.0.get(&link.to_lowercase()).map(|s| s.to_owned())
    }
}

/// Construct a map of links (lower-case page names and redirects) to processed genres.
///
/// We use processed genres to ensure that we're capturing subgenres / headings-under-genres as well.
///
/// This will loop over all redirects and find redirects to already-resolved genres, adding them to the map.
/// It will continue to do this until no new links are found.
pub fn resolve(
    start: std::time::Instant,
    links_to_articles_path: &Path,
    processed_genres: &process::ProcessedGenres,
    all_redirects: extract::AllRedirects,
) -> anyhow::Result<LinksToArticles> {
    if links_to_articles_path.is_file() {
        let links_to_articles: HashMap<String, PageName> =
            toml::from_str(&std::fs::read_to_string(links_to_articles_path)?)?;
        println!(
            "{:.2}s: loaded all {} links to articles",
            start.elapsed().as_secs_f32(),
            links_to_articles.len()
        );
        return Ok(LinksToArticles(links_to_articles));
    }

    println!(
        "{:.2}s: Resolving links to articles",
        start.elapsed().as_secs_f32()
    );

    let all_redirects: HashMap<_, _> = all_redirects.try_into()?;

    let now = std::time::Instant::now();

    let mut links_to_articles: HashMap<String, PageName> = processed_genres
        .0
        .keys()
        .map(|s| (s.to_string().to_lowercase(), s.clone()))
        .collect();

    let mut round = 1;
    loop {
        let mut added = false;
        for (page, redirect) in &all_redirects {
            let page = page.to_string().to_lowercase();
            let redirect = redirect.to_string().to_lowercase();

            if let Some(target) = links_to_articles.get(&redirect) {
                let newly_added = links_to_articles.insert(page, target.clone()).is_none();
                added |= newly_added;
            }
        }
        println!(
            "{:.2}s: round {round}, {} links",
            start.elapsed().as_secs_f32(),
            links_to_articles.len()
        );
        if !added {
            break;
        }
        round += 1;
    }
    println!(
        "{:.2}s: {} links fully resolved",
        start.elapsed().as_secs_f32(),
        links_to_articles.len()
    );

    // Save links to articles to file
    std::fs::write(
        links_to_articles_path,
        toml::to_string_pretty(&links_to_articles)?.as_bytes(),
    )
    .context("Failed to write links to articles")?;
    println!(
        "{:.2}s: Saved links to articles",
        now.elapsed().as_secs_f32()
    );

    Ok(LinksToArticles(links_to_articles))
}
