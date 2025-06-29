//! CLI for populating mixes for genres.
use std::{
    collections::HashSet,
    io::Write as _,
    path::Path,
    time::{Duration, Instant},
};

use wikitext_util::{nodes_inner_text_with_config, wikipedia_pwt_configuration, InnerTextConfig};

use crate::{extract, process, types::PageName};

/// Loops over all genres that don't have a mix yet and prompts the user to fill in a mix.
pub fn run(
    mixes_path: &Path,
    dump_meta: &extract::DumpMeta,
    processed_genres: &process::ProcessedGenres,
) -> anyhow::Result<()> {
    let pwt_configuration = wikipedia_pwt_configuration();

    let already_existing_mixes = std::fs::read_dir(mixes_path)?
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|p| p.is_file())
        .map(|p| PageName::unsanitize(&p.file_name().unwrap().to_string_lossy()))
        .collect::<HashSet<_>>();

    let mut needs_filling = processed_genres
        .0
        .values()
        .filter(|pg| !already_existing_mixes.contains(&pg.page))
        .collect::<Vec<_>>();
    needs_filling.sort_by(|a, b| {
        a.edge_count()
            .cmp(&b.edge_count())
            .then_with(|| a.page.cmp(&b.page))
    });
    needs_filling.reverse();

    println!(
        "{} genres to go, bucko ({} already have mixes)",
        needs_filling.len(),
        already_existing_mixes.len()
    );

    let mut total_response_time = Duration::new(0, 0);

    for (index, pg) in needs_filling.iter().enumerate() {
        let mut description = nodes_inner_text_with_config(
            &pwt_configuration
                .parse(pg.wikitext_description.as_deref().unwrap_or_default())
                .unwrap()
                .nodes,
            InnerTextConfig {
                stop_after_br: true,
            },
        );
        if let Some(dot_idx) = description.find('.') {
            description.truncate(dot_idx + 1);
        }

        let wikipedia_page_link = format!(
            "https://{}/wiki/{}",
            dump_meta.wikipedia_domain,
            pg.page.linksafe()
        );

        let avg_response_time = if index > 0 {
            format!("avg response: {:?}", total_response_time / index as u32)
        } else {
            String::new()
        };

        println!(
            "==> {}/{}: {} ({}) {}{}",
            index + 1,
            needs_filling.len(),
            pg.page,
            wikipedia_page_link,
            description,
            if index > 0 {
                format!(" ({avg_response_time})")
            } else {
                String::new()
            }
        );

        let genre_name = &pg.name.0;
        let link = format!(
            "https://www.youtube.com/results?search_query={}&sp=EgQQARgC",
            (if genre_name.to_lowercase().contains("music") {
                format!("\"{genre_name}\" mix")
            } else {
                format!("\"{genre_name}\" music mix")
            })
            .replace(" ", "%20")
            .replace("&", "%26")
        );
        open::that(link)?;

        print!("> ");
        std::io::stdout().flush()?;

        let start_time = Instant::now();
        let mut line = String::new();
        std::io::stdin().read_line(&mut line)?;

        if line.trim() == "finish" {
            break;
        }

        let response_time = start_time.elapsed();

        total_response_time += response_time;

        if let Some(amp_idx) = line.find('&') {
            line.truncate(amp_idx);
        }
        line = line.trim().to_string();

        let mix_path = mixes_path.join(PageName::sanitize(&pg.page));
        std::fs::write(mix_path, line)?;
    }

    Ok(())
}
