//! Resolves links to articles and builds a map of links to page names.
use std::{
    collections::{BTreeMap, BTreeSet},
    path::Path,
};

use anyhow::Context as _;

use crate::{extract, types::PageName};

/// A map of links to page names.
pub struct LinksToArticles(pub BTreeMap<String, PageName>);
impl LinksToArticles {
    /// Get the page name for a link.
    pub fn map(&self, link: &str) -> Option<PageName> {
        self.0.get(&link.to_lowercase()).map(|s| s.to_owned())
    }
}

/// Original-cased redirect titles that resolve to each tracked page.
///
/// Note that redirects preserve `#heading` targets, so heading-genres get
/// their own aliases here rather than sharing their parent page's.
pub struct PageAliases(pub BTreeMap<PageName, BTreeSet<String>>);
impl PageAliases {
    /// Sum the inbound link counts of `page` itself (when it is a page root,
    /// i.e. has no heading) and of all redirect pages that resolve to it.
    ///
    /// Counting redirect pages is what gives heading-genres a link count of
    /// their own: `pagelinks` drops `#heading` fragments, so links written
    /// directly as `[[Page#Heading]]` are unrecoverable and attribute to the
    /// parent page, but links via a redirect (the common case) count toward
    /// the redirect's title, which we resolve heading and all.
    pub fn aggregated_link_count(
        &self,
        page: &PageName,
        counts: &BTreeMap<PageName, usize>,
    ) -> usize {
        let own = if page.heading.is_none() {
            counts.get(page).copied().unwrap_or(0)
        } else {
            0
        };
        let via_redirects: usize = self
            .0
            .get(page)
            .into_iter()
            .flatten()
            .filter_map(|alias| counts.get(&PageName::new(alias.as_str(), None)))
            .sum();
        own + via_redirects
    }
}

/// Construct a map of links (lower-case page names and redirects) to pages,
/// along with the original-cased redirect titles per page ([`PageAliases`]).
///
/// We use pages to ensure that we're capturing subgenres / headings-under-pages as well.
///
/// This will loop over all redirects and find redirects to already-resolved pages, adding them to the map.
/// It will continue to do this until no new links are found.
pub fn resolve<'a>(
    start: std::time::Instant,
    links_to_articles_path: &Path,
    page_aliases_path: &Path,
    pages: impl Iterator<Item = &'a PageName>,
    all_redirects: extract::AllRedirects,
) -> anyhow::Result<(LinksToArticles, PageAliases)> {
    // Only use the cache when both files exist; otherwise recompute both.
    if links_to_articles_path.is_file() && page_aliases_path.is_file() {
        let links_to_articles: BTreeMap<String, PageName> = serde_json::from_slice(
            &std::fs::read(links_to_articles_path).context("Failed to read links to articles")?,
        )
        .context("Failed to parse links to articles")?;
        let page_aliases: BTreeMap<PageName, BTreeSet<String>> = serde_json::from_slice(
            &std::fs::read(page_aliases_path).context("Failed to read page aliases")?,
        )
        .context("Failed to parse page aliases")?;
        println!(
            "{:.2}s: loaded all {} links to articles and aliases for {} pages",
            start.elapsed().as_secs_f32(),
            links_to_articles.len(),
            page_aliases.len()
        );
        return Ok((
            LinksToArticles(links_to_articles),
            PageAliases(page_aliases),
        ));
    }

    println!(
        "{:.2}s: resolving links to articles",
        start.elapsed().as_secs_f32()
    );

    let all_redirects: BTreeMap<_, _> = all_redirects.try_into()?;

    let now = std::time::Instant::now();

    let mut links_to_articles: BTreeMap<String, PageName> = BTreeMap::new();
    for page in pages {
        links_to_articles.insert(page.to_string().to_lowercase(), page.clone());
    }

    let mut page_aliases: BTreeMap<PageName, BTreeSet<String>> = BTreeMap::new();

    let mut round = 1;
    loop {
        let mut added = false;
        for (page, redirect) in &all_redirects {
            let page_lower = page.to_string().to_lowercase();
            let redirect = redirect.to_string().to_lowercase();

            if let Some(target) = links_to_articles.get(&redirect) {
                let target = target.clone();
                let newly_added = links_to_articles
                    .insert(page_lower, target.clone())
                    .is_none();
                if newly_added {
                    // Keep the original-cased redirect title as an alias
                    page_aliases
                        .entry(target)
                        .or_default()
                        .insert(page.to_string());
                }
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

    // Save links to articles and page aliases to file
    std::fs::write(
        links_to_articles_path,
        serde_json::to_string_pretty(&links_to_articles)?,
    )
    .context("Failed to write links to articles")?;
    std::fs::write(
        page_aliases_path,
        serde_json::to_string_pretty(&page_aliases)?,
    )
    .context("Failed to write page aliases")?;
    println!(
        "{:.2}s: saved links to articles and page aliases",
        now.elapsed().as_secs_f32()
    );

    Ok((
        LinksToArticles(links_to_articles),
        PageAliases(page_aliases),
    ))
}
