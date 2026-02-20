//! Processes the wikitext for each genre page to extract the genre infobox's information.
use std::{
    collections::{BTreeMap, HashSet},
    path::Path,
    sync::{LazyLock, atomic::AtomicUsize},
};

use jiff::ToSpan as _;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use wikitext_util::{
    InnerTextConfig, NodeMetadata, NodeMetadataType, nodes_inner_text,
    nodes_inner_text_with_config, parse_wiki_text_2 as pwt, wikipedia_pwt_configuration,
};

use crate::{
    data_patches, extract,
    types::{ArtistName, GenreName, PageName},
};

trait ProcessedPage:
    Send + Sync + Clone + std::fmt::Debug + serde::Serialize + for<'de> serde::Deserialize<'de>
{
    type NameType: Clone;
    fn name(&self) -> &PageName;
    fn update_description(&mut self, description: String);
    fn get_display_name(&self) -> String;

    fn save(&self, processed_path: &Path) -> anyhow::Result<()> {
        std::fs::write(
            processed_path.join(format!("{}.json", PageName::sanitize(self.name()))),
            serde_json::to_string_pretty(self)?,
        )?;
        Ok(())
    }
}

/// A processed genre containing all the information we can extract from the infobox.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProcessedGenre {
    /// The name of the genre.
    pub name: GenreName,
    /// The page name of the genre.
    pub page: PageName,
    /// The description of the genre, extracted from the page.
    ///
    /// This is all text after the infobox to the next heading.
    /// There are some nuances around what "after" means; we
    /// bodge the extraction to handle the case where the infobox was misplaced.
    pub wikitext_description: Option<String>,
    /// The timestamp of the last revision of the page.
    pub last_revision_date: jiff::Timestamp,
    // the following are unresolved links: we do this
    // so that we can defer link resolution to the end of the pipeline
    // to make sure we've gotten the links to headings under pages
    /// Stylistic origins of the genre.
    pub stylistic_origins: Vec<String>,
    /// Derivatives of the genre.
    pub derivatives: Vec<String>,
    /// Subgenres of the genre.
    pub subgenres: Vec<String>,
    /// Fusion genres of the genre.
    pub fusion_genres: Vec<String>,
}
impl ProcessedPage for ProcessedGenre {
    type NameType = GenreName;
    fn name(&self) -> &PageName {
        &self.page
    }
    fn update_description(&mut self, description: String) {
        self.wikitext_description = Some(description.trim().to_string());
    }
    fn get_display_name(&self) -> String {
        self.name.0.clone()
    }
}
impl ProcessedGenre {
    /// The number of edges in the genre's graph.
    pub fn edge_count(&self) -> usize {
        self.stylistic_origins.len()
            + self.derivatives.len()
            + self.subgenres.len()
            + self.fusion_genres.len()
    }
}

/// A map of page names to their processed genre.
pub struct ProcessedGenres(pub BTreeMap<PageName, ProcessedGenre>);
/// Given raw genre wikitext, extract the relevant information and save it to file.
pub fn genres(
    start: std::time::Instant,
    genres: &extract::GenrePages,
    processed_genres_path: &Path,
) -> anyhow::Result<ProcessedGenres> {
    let all_patches = data_patches::genre_all();

    let genre_processor = |parameters: BTreeMap<String, &[pwt::Node]>,
                           original_page: &PageName,
                           last_heading: Option<String>,
                           timestamp: jiff::Timestamp|
     -> ProcessedGenre {
        let mut name = extract_name_from_parameter(parameters.get("name").copied(), original_page);

        if let Some((patch_timestamp, new_name)) = all_patches.get(original_page) {
            // Check whether the article has been updated since the last revision date
            // with one minute of leeway. If it has, don't apply the patch.
            if patch_timestamp
                .map(|ts| timestamp.saturating_add(1.minute()) < ts)
                .unwrap_or(true)
            {
                name = new_name.0.clone();
            }
        }

        let stylistic_origins = parameters
            .get("stylistic_origins")
            .map(|ns| get_links_from_nodes(ns))
            .unwrap_or_default();
        let derivatives = parameters
            .get("derivatives")
            .map(|ns| get_links_from_nodes(ns))
            .unwrap_or_default();
        let subgenres = parameters
            .get("subgenres")
            .map(|ns| get_links_from_nodes(ns))
            .unwrap_or_default();
        let fusion_genres = parameters
            .get("fusiongenres")
            .map(|ns| get_links_from_nodes(ns))
            .unwrap_or_default();

        ProcessedGenre {
            name: GenreName(name),
            page: original_page.with_opt_heading(last_heading),
            wikitext_description: None,
            last_revision_date: timestamp,
            stylistic_origins,
            derivatives,
            subgenres,
            fusion_genres,
        }
    };

    let processed_genres = process_pages(
        start,
        &genres.0,
        processed_genres_path,
        "infobox music genre",
        genre_processor,
        "genre",
    )?;

    Ok(ProcessedGenres(processed_genres))
}

/// A processed artist containing all the information we can extract from the infobox.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProcessedArtist {
    /// The name of the artist.
    pub name: ArtistName,
    /// The page name of the artist.
    pub page: PageName,
    /// The description of the artist, extracted from the page.
    ///
    /// This is all text after the infobox to the next heading.
    /// There are some nuances around what "after" means; we
    /// bodge the extraction to handle the case where the infobox was misplaced.
    pub wikitext_description: Option<String>,
    /// The timestamp of the last revision of the page.
    pub last_revision_date: jiff::Timestamp,
    // the following are unresolved links: we do this
    // so that we can defer link resolution to the end of the pipeline
    // to make sure we've gotten the links to headings under pages
    /// Genres of the artist.
    pub genres: Vec<String>,
}
impl ProcessedPage for ProcessedArtist {
    type NameType = ArtistName;
    fn name(&self) -> &PageName {
        &self.page
    }
    fn update_description(&mut self, description: String) {
        self.wikitext_description = Some(description.trim().to_string());
    }
    fn get_display_name(&self) -> String {
        self.name.0.clone()
    }
}

/// A map of page names to their processed artist.
pub struct ProcessedArtists(pub BTreeMap<PageName, ProcessedArtist>);
/// Given raw artist wikitext, extract the relevant information and save it to file.
pub fn artists(
    start: std::time::Instant,
    artists: &extract::ArtistPages,
    processed_artists_path: &Path,
) -> anyhow::Result<ProcessedArtists> {
    let all_patches = data_patches::artist_all();

    let artist_processor = |parameters: BTreeMap<String, &[pwt::Node]>,
                            original_page: &PageName,
                            last_heading: Option<String>,
                            timestamp: jiff::Timestamp|
     -> ProcessedArtist {
        let mut name = extract_name_from_parameter(parameters.get("name").copied(), original_page);

        if let Some((patch_timestamp, new_name)) = all_patches.get(original_page) {
            // Check whether the article has been updated since the last revision date
            // with one minute of leeway. If it has, don't apply the patch.
            if patch_timestamp
                .map(|ts| timestamp.saturating_add(1.minute()) < ts)
                .unwrap_or(true)
            {
                name = new_name.0.clone();
            }
        }

        let genres = parameters
            .get("genre")
            .map(|ns| get_links_from_nodes(ns))
            .unwrap_or_default();

        ProcessedArtist {
            name: ArtistName(name),
            page: original_page.with_opt_heading(last_heading),
            wikitext_description: None,
            last_revision_date: timestamp,
            genres,
        }
    };

    let processed_artists = process_pages(
        start,
        &artists.0,
        processed_artists_path,
        "infobox musical artist",
        artist_processor,
        "artist",
    )?;

    Ok(ProcessedArtists(processed_artists))
}

/// Generic function to process pages and extract infobox information.
fn process_pages<T: ProcessedPage>(
    start: std::time::Instant,
    pages: &BTreeMap<PageName, std::path::PathBuf>,
    processed_path: &Path,
    template_name: &str,
    process_template: impl Fn(
        BTreeMap<String, &[pwt::Node]>,
        &PageName,
        Option<String>,
        jiff::Timestamp,
    ) -> T
    + Send
    + Sync,
    entity_type: &str,
) -> anyhow::Result<BTreeMap<PageName, T>> {
    if processed_path.is_dir() {
        println!(
            "{:.2}s: loading processed {entity_type}s",
            start.elapsed().as_secs_f32()
        );

        let mut processed_items = BTreeMap::default();
        let entries: Vec<_> = std::fs::read_dir(processed_path)?.collect::<Result<Vec<_>, _>>()?;

        let loaded_items: Vec<(PageName, T)> = entries
            .par_iter()
            .filter_map(|entry| {
                let path = entry.path();
                let file_stem = path.file_stem()?;
                let page_name = PageName::unsanitize(&file_stem.to_string_lossy());
                let item: T = serde_json::from_slice(&std::fs::read(&path).ok()?).ok()?;
                Some((page_name, item))
            })
            .collect();

        processed_items.extend(loaded_items);
        remove_ignored_pages_and_detect_duplicates(&mut processed_items);

        println!(
            "{:.2}s: loaded processed {} {entity_type}s",
            start.elapsed().as_secs_f32(),
            processed_items.len()
        );
        return Ok(processed_items);
    }

    println!(
        "{:.2}s: processed {entity_type}s do not exist, generating from raw {entity_type}s",
        start.elapsed().as_secs_f32()
    );

    std::fs::create_dir_all(processed_path)?;

    let pwt_configuration = wikipedia_pwt_configuration();

    let item_count = AtomicUsize::new(0);
    let total_pages = pages.len();
    let progress_increment = (total_pages / 10).max(1); // 10% increments, minimum 1
    let last_reported_milestone = AtomicUsize::new(0);
    let start_time = start; // Capture start time to avoid shadowing in closure

    let dump_page = std::env::var("DUMP_PAGE").ok();

    let processed_items: BTreeMap<PageName, T> = pages.par_iter().flat_map(|(original_page, path)| {
        let wikitext = std::fs::read_to_string(path).unwrap();
        let (wikitext_header, wikitext) = wikitext.split_once("\n").unwrap();
        let wikitext_header: extract::WikitextHeader = serde_json::from_str(wikitext_header).unwrap();

        let wikitext = remove_comments_from_wikitext_the_painful_way(
            &pwt_configuration,
            dump_page.as_deref(),
            original_page,
            wikitext,
        );
        let parsed_wikitext = pwt_configuration
            .parse_with_timeout(&wikitext, std::time::Duration::from_secs(1))
            .unwrap_or_else(|e| panic!("failed to parse wikitext ({original_page}): {e:?}"));
        if dump_page
            .as_deref()
            .is_some_and(|s| s == original_page.name)
        {
            println!("--- AFTER ---");
            dump_page_nodes(&wikitext, &parsed_wikitext.nodes, 0);
        }

        let mut description: Option<String> = None;
        let mut pause_recording_description = false;
        // The `start` of a node doesn't always correspond to the `end` of the last node,
        // so we always save the metadata for the last node to allow for full reconstruction in the description.
        let mut last_node = None;
        fn start_including_last_node(last_node: &mut Option<NodeMetadata>, start: usize) -> usize {
            last_node.take().map(|t| t.end).filter(|&end| end < start).unwrap_or(start)
        }
        let mut last_heading = None;

        let mut processed_item: Option<T> = None;
        let mut page_results = Vec::new();

        for node in &parsed_wikitext.nodes {
            let node_metadata = NodeMetadata::for_node(node);
            match node {
                pwt::Node::Template {
                    name,
                    parameters,
                    start,
                    end,
                    ..
                } => {
                    let template_name_found = nodes_inner_text(name).to_lowercase();

                    // If we're recording the description and there are non-whitespace characters,
                    // this template can be recorded (i.e. "a {{blah}}" is acceptable, "{{blah}}" is not).
                    //
                    // Alternatively, a select list of acceptable templates can be included in the capture,
                    // regardless of the existing description.
                    //
                    // However, there are also some templates where we really don't care about preserving them.
                    if let Some(description) = &mut description {
                        fn is_acceptable_template(template_name: &str) -> bool {
                            static ACCEPTABLE_TEMPLATES: LazyLock<HashSet<&'static str>> =
                                LazyLock::new(|| {
                                    HashSet::from_iter([
                                        "nihongo",
                                        "transliteration",
                                        "tlit",
                                        "transl",
                                        "lang",
                                    ])
                                });
                            ACCEPTABLE_TEMPLATES.contains(template_name)
                        }

                        fn is_ignorable_template(template_name: &str) -> bool {
                            template_name.starts_with("use")
                        }

                        if !pause_recording_description
                            && (!description.trim().is_empty()
                                || is_acceptable_template(&template_name_found))
                            && !is_ignorable_template(&template_name_found)
                        {
                            description.push_str(
                                &wikitext[start_including_last_node(&mut last_node, *start)..*end],
                            );
                        }
                    }
                    last_node = Some(node_metadata);

                    // Check for direct template match or nested template in module parameter
                    let target_parameters = if template_name_found == template_name {
                        // Direct match - use the template's parameters directly
                        Some(parameters_to_map(parameters))
                    } else {
                        // Check if this template has a "module" parameter with our target template,
                        // if so, inject the parameters of the nested template into the parameters map.
                        // We inject, instead of replacing, to allow inheriting parameters from the parent (e.g. name)
                        let mut parameters_map = parameters_to_map(parameters);
                        let mut injected_module_parameters = false;
                        if let Some(module_nodes) = parameters_map.get("module") {
                            // Look for our target template within the module parameter
                            for node in *module_nodes {
                                if let pwt::Node::Template { name: nested_name, parameters: nested_parameters, .. } = node {
                                    let nested_template_name = nodes_inner_text(nested_name).to_lowercase();
                                    if nested_template_name == template_name {
                                        injected_module_parameters = true;
                                        parameters_map.extend(parameters_to_map(nested_parameters));
                                        break;
                                    }
                                }
                            }
                        }
                        if injected_module_parameters {
                            Some(parameters_map)
                        } else {
                            None
                        }
                    };

                    let Some(target_parameters) = target_parameters else {
                        continue;
                    };

                    // If we already have a processed item, save it
                    if let Some(mut processed_item) = processed_item.take() {
                        let new_page = processed_item.name().clone();
                        if let Some(description) = description.take() {
                            processed_item.update_description(description);
                        }
                        page_results.push((new_page.clone(), processed_item.clone()));
                        processed_item.save(processed_path).unwrap();
                        if dump_page
                            .as_deref()
                            .is_some_and(|s| s == original_page.name)
                        {
                            println!(
                                "Saving due to new {entity_type}: {new_page:?} | {}",
                                processed_item.get_display_name()
                            );
                            println!("Description: {processed_item:?}");
                        }
                    }

                    // Let the closure handle the specific processing
                    processed_item = Some(process_template(
                        target_parameters,
                        original_page,
                        last_heading.clone(),
                        wikitext_header.timestamp,
                    ));
                    description = Some(String::new());
                    let current_count = item_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;

                    // Check if we've hit a new milestone
                    let current_milestone = current_count / progress_increment;
                    let last_milestone = last_reported_milestone.load(std::sync::atomic::Ordering::Relaxed);
                    if current_milestone > last_milestone && current_count > 0
                        && last_reported_milestone.compare_exchange_weak(
                            last_milestone,
                            current_milestone,
                            std::sync::atomic::Ordering::Relaxed,
                            std::sync::atomic::Ordering::Relaxed,
                        ).is_ok() {
                            let percentage = ((current_count * 100) / total_pages).min(100);
                            println!(
                                "{:.2}s: processed {current_count}/{total_pages} {entity_type}s ({percentage}%)",
                                start_time.elapsed().as_secs_f32()
                            );
                        }
                }
                pwt::Node::StartTag { name, .. } if name == "ref" => {
                    pause_recording_description = true;
                    last_node = Some(node_metadata);
                }
                pwt::Node::EndTag { name, .. } if name == "ref" => {
                    pause_recording_description = false;
                    last_node = Some(node_metadata);
                }
                pwt::Node::Tag { name, .. } if name == "ref" => {
                    // Explicitly ignore body of a ref tag
                    last_node = Some(node_metadata);
                }
                pwt::Node::Bold { end, start }
                | pwt::Node::BoldItalic { end, start }
                | pwt::Node::Category { end, start, .. }
                | pwt::Node::CharacterEntity { end, start, .. }
                | pwt::Node::DefinitionList { end, start, .. }
                | pwt::Node::ExternalLink { end, start, .. }
                | pwt::Node::HorizontalDivider { end, start }
                | pwt::Node::Italic { end, start }
                | pwt::Node::Link { end, start, .. }
                | pwt::Node::MagicWord { end, start }
                | pwt::Node::OrderedList { end, start, .. }
                | pwt::Node::ParagraphBreak { end, start }
                | pwt::Node::Parameter { end, start, .. }
                | pwt::Node::Preformatted { end, start, .. }
                | pwt::Node::Redirect { end, start, .. }
                | pwt::Node::StartTag { end, start, .. }
                | pwt::Node::EndTag { end, start, .. }
                | pwt::Node::Table { end, start, .. }
                | pwt::Node::Tag { end, start, .. }
                | pwt::Node::Text { end, start, .. }
                | pwt::Node::UnorderedList { end, start, .. } => {
                    if !pause_recording_description
                        && let Some(description) = &mut description {
                            let last_node_was_link = last_node.as_ref().is_some_and(|n| n.ty == NodeMetadataType::Link);
                            let this_node_is_text = matches!(node, pwt::Node::Text { .. });

                            let new_start = if last_node_was_link && this_node_is_text {
                                // HACK: If the last node was a link and this node is text, skip to the end of the link.
                                // This is because links can consume the surrounding text to the right through the magic
                                // of linktrails, and we want to avoid using the text that the link has consumed.
                                last_node.take().map(|n| n.end).unwrap_or(*start)
                            } else {
                                start_including_last_node(&mut last_node, *start)
                            };

                            let new_fragment = &wikitext[new_start..*end];
                            if dump_page
                                .as_deref()
                                .is_some_and(|s| s == original_page.name)
                            {
                                println!("Description: {description:?}");
                                println!("New fragment: {new_fragment:?}");
                                println!("New start: {new_start} vs start: {start}");
                                println!("End: {end}");
                                println!();
                            }
                            description.push_str(new_fragment);
                        }
                    last_node = Some(node_metadata);
                }
                pwt::Node::Heading { nodes, .. } => {
                    if let Some(processed_item) = &mut processed_item {
                        // We continue going if the description so far is empty: some infoboxes are placed
                        // before a heading, with the content following after the heading, so we offer
                        // this as an opportunity to capture that content.
                        if description.as_ref().is_some_and(|s| !s.trim().is_empty()) {
                            processed_item.update_description(description.take().unwrap());
                        } else {
                            last_node = Some(node_metadata);
                        }
                    }

                    last_heading = Some(nodes_inner_text(nodes));
                }
                pwt::Node::Image { .. } | pwt::Node::Comment { .. } => {
                    last_node = Some(node_metadata);
                }
            }
        }

        if let Some(processed_item) = &mut processed_item {
            let new_page = processed_item.name().clone();
            if let Some(description) = description.take() {
                processed_item.update_description(description);
            }
            page_results.push((new_page.clone(), processed_item.clone()));
            processed_item.save(processed_path).unwrap();
            if dump_page
                .as_deref()
                .is_some_and(|s| s == original_page.name)
            {
                println!(
                    "End-of-page save: {new_page:?} | {}",
                    processed_item.get_display_name()
                );
            }
        }

        page_results
    }).collect();

    println!(
        "{:.2}s: processed all {} {entity_type}s",
        start.elapsed().as_secs_f32(),
        item_count.load(std::sync::atomic::Ordering::Relaxed)
    );

    let mut processed_items = processed_items;
    remove_ignored_pages_and_detect_duplicates(&mut processed_items);
    Ok(processed_items)
}

fn dump_page_nodes(wikitext: &str, nodes: &[pwt::Node], depth: usize) {
    for node in nodes {
        print!("{:indent$}", "", indent = depth * 2);
        let metadata = NodeMetadata::for_node(node);
        println!(
            "{:?}[{}..{}]: {:?}",
            metadata.ty,
            metadata.start,
            metadata.end,
            &wikitext[metadata.start..metadata.end]
        );
        if let Some(children) = metadata.children {
            dump_page_nodes(wikitext, children, depth + 1);
        }
    }
}

/// This is monstrous.
/// We are parsing the Wikitext, reconstructing it without the comments, and then parsing it again.
///
/// This is necessary as parse-wiki-text has a bug in which it does not recognise headings
/// where comments immediately follow - i.e.
///   ===Heading===<!-- Lmao -->
/// results in `===Heading===` being parsed as text, not a heading.
///
/// Ideally, this would be fixed upstream, but that looks like a non-trivial fix, and
/// compute and memory is cheap, so... here we go.
fn remove_comments_from_wikitext_the_painful_way(
    pwt_configuration: &pwt::Configuration,
    dump_page: Option<&str>,
    page: &PageName,
    wikitext: &str,
) -> String {
    // HACK: Replace `{{end}}` with `|}` because Wikipedia is demented and uses `{{end}}`
    // to end tables.
    let wikitext = wikitext.replace("{{end}}", "|}");

    let parsed_wikitext = pwt_configuration
        .parse_with_timeout(&wikitext, std::time::Duration::from_secs(1))
        .unwrap_or_else(|e| panic!("failed to parse wikitext ({page}): {e:?}"));

    let mut new_wikitext = wikitext.to_string();
    let mut comment_ranges = vec![];

    if dump_page.is_some_and(|s| s == page.name) {
        println!("--- BEFORE ---");
        dump_page_nodes(&wikitext, &parsed_wikitext.nodes, 0);
    }

    for node in &parsed_wikitext.nodes {
        if let pwt::Node::Comment { start, end, .. } = node {
            comment_ranges.push((*start, *end));
        }
    }

    for (start, end) in comment_ranges.into_iter().rev() {
        new_wikitext.replace_range(start..end, "");
    }

    new_wikitext
}

fn remove_ignored_pages_and_detect_duplicates<T: ProcessedPage>(
    processed_pages: &mut BTreeMap<PageName, T>,
) {
    for page in data_patches::pages_to_ignore() {
        processed_pages.remove(&page);
    }

    let mut previously_encountered_pages = BTreeMap::new();
    for (page, processed_page) in processed_pages.iter() {
        if let Some(old_page) =
            previously_encountered_pages.insert(processed_page.name().clone(), page.clone())
        {
            panic!(
                "Duplicate page `{}` on pages `{old_page}` and `{page}`",
                processed_page.name()
            );
        }
    }
}

fn get_links_from_nodes(nodes: &[pwt::Node]) -> Vec<String> {
    let mut output = vec![];
    nodes_recurse(nodes, &mut output, |output, node| {
        if let pwt::Node::Link { target, .. } = node {
            output.push(target.to_string());
            false
        } else {
            true
        }
    });
    output
}

fn nodes_recurse<R>(
    nodes: &[pwt::Node],
    result: &mut R,
    operator: impl Fn(&mut R, &pwt::Node) -> bool + Copy,
) {
    for node in nodes {
        node_recurse(node, result, operator);
    }
}

fn node_recurse<R>(
    node: &pwt::Node,
    result: &mut R,
    operator: impl Fn(&mut R, &pwt::Node) -> bool + Copy,
) {
    use pwt::Node;
    if !operator(result, node) {
        return;
    }
    match node {
        Node::Category { ordinal, .. } => nodes_recurse(ordinal, result, operator),
        Node::DefinitionList { items, .. } => {
            for item in items {
                nodes_recurse(&item.nodes, result, operator);
            }
        }
        Node::ExternalLink { nodes, .. } => nodes_recurse(nodes, result, operator),
        Node::Heading { nodes, .. } => nodes_recurse(nodes, result, operator),
        Node::Link { text, .. } => nodes_recurse(text, result, operator),
        Node::OrderedList { items, .. } | Node::UnorderedList { items, .. } => {
            for item in items {
                nodes_recurse(&item.nodes, result, operator);
            }
        }
        Node::Parameter { default, name, .. } => {
            if let Some(default) = &default {
                nodes_recurse(default, result, operator);
            }
            nodes_recurse(name, result, operator);
        }
        Node::Preformatted { nodes, .. } => nodes_recurse(nodes, result, operator),
        Node::Table {
            attributes,
            captions,
            rows,
            ..
        } => {
            nodes_recurse(attributes, result, operator);
            for caption in captions {
                if let Some(attributes) = &caption.attributes {
                    nodes_recurse(attributes, result, operator);
                }
                nodes_recurse(&caption.content, result, operator);
            }
            for row in rows {
                nodes_recurse(&row.attributes, result, operator);
                for cell in &row.cells {
                    if let Some(attributes) = &cell.attributes {
                        nodes_recurse(attributes, result, operator);
                    }
                    nodes_recurse(&cell.content, result, operator);
                }
            }
        }
        Node::Tag { nodes, .. } => {
            nodes_recurse(nodes, result, operator);
        }
        Node::Template {
            name, parameters, ..
        } => {
            nodes_recurse(name, result, operator);
            for parameter in parameters {
                if let Some(name) = &parameter.name {
                    nodes_recurse(name, result, operator);
                }
                nodes_recurse(&parameter.value, result, operator);
            }
        }
        _ => {}
    }
}

fn parameters_to_map<'a>(
    parameters: &'a [pwt::Parameter<'a>],
) -> BTreeMap<String, &'a [pwt::Node<'a>]> {
    parameters
        .iter()
        .filter_map(|p| Some((nodes_inner_text(p.name.as_deref()?), p.value.as_slice())))
        .collect()
}

/// Extract the name from a template parameter, falling back to the page name if not specified.
fn extract_name_from_parameter(
    name_parameter: Option<&[pwt::Node]>,
    original_page: &PageName,
) -> String {
    let original_page_name = original_page
        .heading
        .as_ref()
        .unwrap_or(&original_page.name);
    match name_parameter {
        None | Some([]) => original_page_name.clone(),
        Some(nodes) => {
            let name = nodes_inner_text_with_config(
                nodes,
                InnerTextConfig {
                    // Some genre headings have a `<br>` tag, followed by another name.
                    // We only want the first name, so stop after the first `<br>`.
                    stop_after_br: true,
                },
            );
            if name.is_empty() {
                original_page_name.clone()
            } else {
                name
            }
        }
    }
}
