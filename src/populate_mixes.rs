use std::{collections::HashSet, io::Write as _, path::Path};

use wikitext_util::{nodes_inner_text, pwt_configuration, InnerTextConfig};

use crate::{preparation, process, types::PageName};

pub fn run(
    mixes_path: &Path,
    dump_meta: &preparation::DumpMeta,
    processed_genres: &process::ProcessedGenres,
) -> anyhow::Result<()> {
    let pwt_configuration = pwt_configuration();

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

    for pg in needs_filling {
        let mut description = nodes_inner_text(
            &pwt_configuration
                .parse(pg.wikitext_description.as_deref().unwrap_or_default())
                .unwrap()
                .nodes,
            &InnerTextConfig {
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

        println!("==> {} ({wikipedia_page_link}): {description}", pg.page);

        let genre_name = &pg.name.0;
        let link = format!(
            "https://www.youtube.com/results?search_query={}&sp=EgQQARgC",
            (if genre_name.to_lowercase().contains("music") {
                format!("\"{genre_name}\" mix")
            } else {
                format!("\"{genre_name}\" music mix")
            })
            .replace(" ", "%20")
        );
        open::that(link)?;

        print!("> ");
        std::io::stdout().flush()?;
        let mut line = String::new();
        std::io::stdin().read_line(&mut line)?;

        if let Some(amp_idx) = line.find('&') {
            line.truncate(amp_idx);
        }
        line = line.trim().to_string();

        let mix_path = mixes_path.join(PageName::sanitize(&pg.page));
        std::fs::write(mix_path, line)?;
    }

    Ok(())
}
