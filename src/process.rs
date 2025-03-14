//! Processes the wikitext for each genre page to extract the genre infobox's information.
use std::{
    collections::{HashMap, HashSet},
    path::Path,
    sync::LazyLock,
};

use jiff::ToSpan as _;
use parse_wiki_text_2 as pwt;
use serde::{Deserialize, Serialize};
use wikitext_util::{nodes_inner_text, pwt_configuration, InnerTextConfig, NodeMetadata};

use crate::{
    data_patches, preparation,
    types::{GenreName, PageName},
};

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
impl ProcessedGenre {
    /// The number of edges in the genre's graph.
    pub fn edge_count(&self) -> usize {
        self.stylistic_origins.len()
            + self.derivatives.len()
            + self.subgenres.len()
            + self.fusion_genres.len()
    }
    /// Update the description of the genre.
    pub fn update_description(&mut self, description: String) {
        self.wikitext_description = Some(description.trim().to_string());
    }
    /// Save the processed genre to a file.
    pub fn save(&self, processed_genres_path: &Path) -> anyhow::Result<()> {
        std::fs::write(
            processed_genres_path.join(format!("{}.json", PageName::sanitize(&self.page))),
            serde_json::to_string_pretty(self)?,
        )?;
        Ok(())
    }
}

/// A map of page names to their processed genre.
pub struct ProcessedGenres(pub HashMap<PageName, ProcessedGenre>);
/// Given raw genre wikitext, extract the relevant information and save it to file.
pub fn genres(
    start: std::time::Instant,
    genres: &preparation::GenrePages,
    processed_genres_path: &Path,
) -> anyhow::Result<ProcessedGenres> {
    if processed_genres_path.is_dir() {
        let mut processed_genres = HashMap::default();
        for entry in std::fs::read_dir(processed_genres_path)? {
            let path = entry?.path();
            let Some(file_stem) = path.file_stem() else {
                continue;
            };
            processed_genres.insert(
                PageName::unsanitize(&file_stem.to_string_lossy()),
                serde_json::from_str(&std::fs::read_to_string(path)?)?,
            );
        }
        let mut output = ProcessedGenres(processed_genres);
        remove_ignored_pages_and_detect_duplicates(&mut output);
        return Ok(output);
    }

    println!("Processed genres do not exist, generating from raw genres");

    std::fs::create_dir_all(processed_genres_path)?;

    let pwt_configuration = pwt_configuration();
    let all_patches = data_patches::all();

    let mut processed_genres = HashMap::default();
    let mut genre_count = 0usize;
    let mut stylistic_origin_count = 0usize;
    let mut derivative_count = 0usize;

    let dump_page = std::env::var("DUMP_PAGE").ok();

    fn dump_page_nodes(wikitext: &str, nodes: &[pwt::Node], depth: usize) {
        for node in nodes {
            print!("{:indent$}", "", indent = depth * 2);
            let metadata = NodeMetadata::for_node(node);
            println!(
                "{}[{}..{}]: {:?}",
                metadata.name,
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
        let parsed_wikitext = pwt_configuration
            .parse_with_timeout(wikitext, std::time::Duration::from_secs(1))
            .unwrap_or_else(|e| panic!("failed to parse wikitext ({page}): {e:?}"));

        let mut new_wikitext = wikitext.to_string();
        let mut comment_ranges = vec![];

        if dump_page.is_some_and(|s| s == page.name) {
            println!("--- BEFORE ---");
            dump_page_nodes(wikitext, &parsed_wikitext.nodes, 0);
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

    for (original_page, path) in genres.iter() {
        let wikitext = std::fs::read_to_string(path)?;
        let (wikitext_header, wikitext) = wikitext.split_once("\n").unwrap();
        let wikitext_header: preparation::WikitextHeader = serde_json::from_str(wikitext_header)?;

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
        // so we always save the `end` to allow for full reconstruction in the description.
        let mut last_end = None;
        fn start_including_last_end(last_end: &mut Option<usize>, start: usize) -> usize {
            last_end.take().filter(|&end| end < start).unwrap_or(start)
        }
        let mut last_heading = None;

        let mut processed_genre: Option<ProcessedGenre> = None;

        for node in &parsed_wikitext.nodes {
            match node {
                pwt::Node::Template {
                    name,
                    parameters,
                    start,
                    end,
                    ..
                } => {
                    let template_name =
                        nodes_inner_text(name, &InnerTextConfig::default()).to_lowercase();

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
                                || is_acceptable_template(&template_name))
                            && !is_ignorable_template(&template_name)
                        {
                            description.push_str(
                                &wikitext[start_including_last_end(&mut last_end, *start)..*end],
                            );
                        }
                    }
                    last_end = Some(*end);

                    if template_name != "infobox music genre" {
                        continue;
                    }

                    // If we already have a processed genre, save it
                    if let Some(mut processed_genre) = processed_genre.take() {
                        let new_page = processed_genre.page.clone();
                        if let Some(description) = description.take() {
                            processed_genre.update_description(description);
                        }
                        processed_genres.insert(new_page.clone(), processed_genre.clone());
                        processed_genre.save(processed_genres_path)?;
                        if dump_page
                            .as_deref()
                            .is_some_and(|s| s == original_page.name)
                        {
                            println!(
                                "Saving due to new genre: {new_page:?} | {}",
                                processed_genre.name
                            );
                            println!("Description: {:?}", processed_genre.wikitext_description);
                        }
                    }

                    let parameters = parameters_to_map(parameters);
                    let mut name = GenreName(match parameters.get("name") {
                        None | Some([]) => original_page
                            .heading
                            .as_ref()
                            .unwrap_or(&original_page.name)
                            .clone(),
                        Some(nodes) => {
                            let name = nodes_inner_text(
                                nodes,
                                &InnerTextConfig {
                                    // Some genre headings have a `<br>` tag, followed by another name.
                                    // We only want the first name, so stop after the first `<br>`.
                                    stop_after_br: true,
                                },
                            );
                            if name.is_empty() {
                                panic!(
                                    "Failed to extract name from {original_page}, params: {parameters:?}"
                                );
                            }
                            name
                        }
                    });
                    if let Some((timestamp, new_name)) = all_patches.get(original_page) {
                        // Check whether the article has been updated since the last revision date
                        // with one minute of leeway. If it has, don't apply the patch.
                        if timestamp
                            .map(|ts| wikitext_header.timestamp.saturating_add(1.minute()) < ts)
                            .unwrap_or(true)
                        {
                            name = new_name.clone();
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

                    genre_count += 1;
                    stylistic_origin_count += stylistic_origins.len();
                    derivative_count += derivatives.len();

                    processed_genre = Some(ProcessedGenre {
                        name: name.clone(),
                        page: original_page.with_opt_heading(last_heading.clone()),
                        wikitext_description: None,
                        last_revision_date: wikitext_header.timestamp,
                        stylistic_origins,
                        derivatives,
                        subgenres,
                        fusion_genres,
                    });
                    description = Some(String::new());
                }
                pwt::Node::StartTag { name, end, .. } if name == "ref" => {
                    pause_recording_description = true;
                    last_end = Some(*end);
                }
                pwt::Node::EndTag { name, end, .. } if name == "ref" => {
                    pause_recording_description = false;
                    last_end = Some(*end);
                }
                pwt::Node::Tag { name, end, .. } if name == "ref" => {
                    // Explicitly ignore body of a ref tag
                    last_end = Some(*end);
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
                    if !pause_recording_description {
                        if let Some(description) = &mut description {
                            let new_start = start_including_last_end(&mut last_end, *start);
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
                    }
                    last_end = Some(*end);
                }
                pwt::Node::Heading { nodes, end, .. } => {
                    if let Some(processed_genre) = &mut processed_genre {
                        // We continue going if the description so far is empty: some infoboxes are placed
                        // before a heading, with the content following after the heading, so we offer
                        // this as an opportunity to capture that content.
                        if description.as_ref().is_some_and(|s| !s.trim().is_empty()) {
                            processed_genre.update_description(description.take().unwrap());
                            processed_genre.page =
                                processed_genre.page.with_opt_heading(last_heading.clone());
                        } else {
                            last_end = Some(*end);
                        }
                    }

                    last_heading = Some(nodes_inner_text(nodes, &InnerTextConfig::default()));
                }
                pwt::Node::Image { end, .. } | pwt::Node::Comment { end, .. } => {
                    last_end = Some(*end);
                }
            }
        }

        if let Some(processed_genre) = &mut processed_genre {
            let new_page = processed_genre.page.clone();
            if let Some(description) = description.take() {
                processed_genre.update_description(description);
            }
            processed_genres.insert(new_page.clone(), processed_genre.clone());
            processed_genre.save(processed_genres_path)?;
            if dump_page
                .as_deref()
                .is_some_and(|s| s == original_page.name)
            {
                println!("End-of-page save: {new_page:?} | {}", processed_genre.name);
                println!("Description: {:?}", processed_genre.wikitext_description);
            }
        }
    }

    println!(
        "{:.2}s: Processed all {genre_count} genres, {stylistic_origin_count} stylistic origins, {derivative_count} derivatives",
        start.elapsed().as_secs_f32()
    );

    let mut output = ProcessedGenres(processed_genres);
    remove_ignored_pages_and_detect_duplicates(&mut output);
    Ok(output)
}

fn remove_ignored_pages_and_detect_duplicates(processed_genres: &mut ProcessedGenres) {
    for page in data_patches::pages_to_ignore() {
        processed_genres.0.remove(&page);
    }

    let mut previously_encountered_genres = HashMap::new();
    for (page, processed_genre) in processed_genres.0.iter() {
        if let Some(old_page) =
            previously_encountered_genres.insert(processed_genre.name.clone(), page.clone())
        {
            panic!(
                "Duplicate genre `{}` on pages `{old_page}` and `{page}`",
                processed_genre.name
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
) -> HashMap<String, &'a [pwt::Node<'a>]> {
    parameters
        .iter()
        .filter_map(|p| {
            Some((
                nodes_inner_text(p.name.as_deref()?, &InnerTextConfig::default()),
                p.value.as_slice(),
            ))
        })
        .collect()
}
