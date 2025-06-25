//! Processes Wikipedia dumps to extract music genres and produce data for a graph.
#![warn(missing_docs)]

use anyhow::Context;

use std::path::Path;

pub mod data_patches;
pub mod extract;
pub mod links;
pub mod output;
pub mod populate_mixes;
pub mod process;
pub mod types;
pub mod util;

fn main() -> anyhow::Result<()> {
    let config: types::Config = {
        let config_str =
            std::fs::read_to_string("config.toml").context("Failed to read config.toml")?;
        toml::from_str(&config_str).context("Failed to parse config.toml")?
    };

    let dump_date = util::parse_wiki_dump_date(
        &config
            .wikipedia_dump_path
            .file_stem()
            .unwrap()
            .to_string_lossy(),
    )
    .with_context(|| {
        format!(
            "Failed to parse Wikipedia dump date from {:?}",
            config.wikipedia_dump_path
        )
    })?;

    let index_date = util::parse_wiki_dump_date(
        &config
            .wikipedia_index_path
            .file_stem()
            .unwrap()
            .to_string_lossy(),
    )
    .with_context(|| {
        format!(
            "Failed to parse Wikipedia dump date from {:?}",
            config.wikipedia_index_path
        )
    })?;

    anyhow::ensure!(
        dump_date == index_date,
        "Wikipedia dump date ({}) does not match index date ({})",
        dump_date,
        index_date
    );

    let output_path = Path::new("output").join(dump_date.to_string());
    let start = std::time::Instant::now();

    let (dump_meta, genres, _artists, all_redirects) = extract::genres_artists_and_all_redirects(
        &config,
        start,
        dump_date,
        &output_path.join("offsets.txt"),
        &output_path.join("meta.toml"),
        &output_path.join("genres"),
        &output_path.join("artists"),
        &output_path.join("all_redirects.toml"),
    )?;

    let processed_genres = process::genres(start, &genres, &output_path.join("processed"))?;

    let mixes_path = Path::new("mixes");
    if std::env::args().any(|arg| arg == "--populate-mixes") {
        populate_mixes::run(mixes_path, &dump_meta, &processed_genres)?;
    }

    let links_to_articles = links::resolve(
        start,
        &output_path.join("links_to_articles.toml"),
        &processed_genres,
        all_redirects,
    )?;

    let website_path = Path::new("website");
    let website_public_path = website_path.join("public");

    {
        let icon = image::open(Path::new("assets/icon.png"))?;

        icon.resize(128, 128, image::imageops::FilterType::Lanczos3)
            .save(website_public_path.join("icon.png"))?;

        icon.resize(32, 32, image::imageops::FilterType::Lanczos3)
            .save(website_public_path.join("favicon.ico"))?;
    }

    output::produce_data_json(
        start,
        &dump_meta,
        mixes_path,
        &website_public_path.join("data.json"),
        &links_to_articles,
        &processed_genres,
    )
}
