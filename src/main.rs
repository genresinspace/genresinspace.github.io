use anyhow::Context;
use quick_xml::events::Event;
use serde::Deserialize;
use std::{
    collections::{HashMap, HashSet},
    io::{BufRead, Write},
    path::{Path, PathBuf},
};

#[derive(Debug, Deserialize)]
struct Config {
    wikipedia_dump_path: PathBuf,
}

fn main() -> anyhow::Result<()> {
    let config: Config = {
        let config_str =
            std::fs::read_to_string("config.toml").context("Failed to read config.toml")?;
        toml::from_str(&config_str).context("Failed to parse config.toml")?
    };

    let output = Path::new("output");
    let genres = output.join("genres");
    let redirects = output.join("redirects.toml");

    let start = std::time::Instant::now();

    // Stage 1: Extract genres
    if !genres.is_dir() {
        let now = std::time::Instant::now();
        std::fs::create_dir_all(&genres).context("Failed to create genres directory")?;

        process_wikipedia_dump(
            &config.wikipedia_dump_path,
            true,
            |title, text, _redirect| {
                let text = text.unwrap();
                if text.contains("nfobox music genre") {
                    if title.contains(":") {
                        return Ok(());
                    }
                    std::fs::write(
                        genres.join(format!("{}.wikitext", sanitize_title_reversible(title))),
                        text,
                    )
                    .with_context(|| format!("Failed to write genre {title}"))?;
                    println!("{:.2}s: {title}", start.elapsed().as_secs_f32());
                }
                Ok(())
            },
        )?;
        println!("Extracted genres in {:?}", now.elapsed());
    } else {
        println!("Genres directory already exists, skipping reading Wikipedia dump");
    }

    // Stage 2: Extract all redirects, so that we can find redirects to genres.
    if !redirects.is_file() {
        let now = std::time::Instant::now();
        let mut count = 0;
        // Using a TOML table and updating it is probably slightly excessive, but we want to make sure values are sanitised correctly
        let mut table = toml::value::Table::with_capacity(1);

        let mut redirects_output = std::fs::File::create(&redirects)?;
        process_wikipedia_dump(
            &config.wikipedia_dump_path,
            false,
            |title, _text, redirect| {
                let Some(redirect) = redirect else {
                    return Ok(());
                };
                table.clear();
                table.insert(title.to_string(), redirect.into());
                writeln!(
                    redirects_output,
                    "{}",
                    toml::to_string_pretty(&table)?.trim()
                )?;
                count += 1;
                if count % 1000 == 0 {
                    println!("{:.2}s: {count} redirects", start.elapsed().as_secs_f32());
                }
                Ok(())
            },
        )?;
        println!("Extracted redirects in {:?}", now.elapsed());
    } else {
        println!("Redirects file already exists, skipping reading Wikipedia dump");
    }

    // Stage 3: Find redirects to genres, looping until we can no longer find any new redirects.
    // This has to be repeated as you could have degree>1 redirects (i.e. redirects to redirects)
    let mut redirect_targets = std::fs::read_dir(&genres)?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            entry
                .path()
                .file_stem()?
                .to_str()
                .map(unsanitize_title_reversible)
        })
        .collect::<HashSet<_>>();

    let mut all_redirects = HashMap::<String, String>::default();
    {
        let file = std::fs::File::open(redirects)?;
        let reader = std::io::BufReader::new(file);
        // We do a line-by-line read to avoid loading the entire file into memory
        // Also to implicitly ignore an issue with duplicates of redirects (we don't really care)
        for line in reader.lines() {
            let line = line?;
            let table: HashMap<String, String> = toml::from_str(&line)?;
            all_redirects.extend(table);
        }
    }
    println!(
        "{:.2}s: loaded {} redirects",
        start.elapsed().as_secs_f32(),
        all_redirects.len()
    );

    let mut genre_redirects: HashMap<String, String> = HashMap::default();

    let mut round = 1;
    loop {
        let mut added = false;
        for (title, redirect) in &all_redirects {
            if redirect_targets.contains(redirect) && !genre_redirects.contains_key(title) {
                redirect_targets.insert(title.clone());
                genre_redirects.insert(title.clone(), redirect.clone());
                added = true;
            }
        }
        println!(
            "{:.2}s: round {round}, {} redirects",
            start.elapsed().as_secs_f32(),
            genre_redirects.len()
        );
        if !added {
            break;
        }
        round += 1;
    }
    println!(
        "{:.2}s: {} redirects fully resolved",
        start.elapsed().as_secs_f32(),
        genre_redirects.len()
    );

    Ok(())
}

fn sanitize_title_reversible(title: &str) -> String {
    title.replace("/", "#")
}
#[allow(dead_code)]
fn unsanitize_title_reversible(title: &str) -> String {
    title.replace("#", "/")
}

// This could be made much faster by loading the file into memory and using the index to attack
// the streams in parallel, but this will only run once every month, so it's not worth optimising.
fn process_wikipedia_dump<F>(path: &Path, needs_text: bool, mut callback: F) -> anyhow::Result<()>
where
    F: FnMut(&str, Option<&str>, Option<&str>) -> anyhow::Result<()>,
{
    let file = std::fs::File::open(path).context("Failed to open Wikipedia dump file")?;
    let decoder = bzip2::bufread::MultiBzDecoder::new(std::io::BufReader::new(file));
    let reader = std::io::BufReader::new(decoder);
    let mut reader = quick_xml::reader::Reader::from_reader(reader);
    reader.config_mut().trim_text(true);

    let mut buf = vec![];
    let mut title = String::new();
    let mut recording_title = false;
    let mut text = String::new();
    let mut recording_text = false;
    let mut redirect = None;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Eof) => break,
            Ok(Event::Start(e)) => {
                let name = e.name().0;
                if name == b"title" {
                    title.clear();
                    recording_title = true;
                } else if needs_text && name == b"text" {
                    text.clear();
                    recording_text = true;
                }
            }
            Ok(Event::Text(e)) => {
                if recording_title {
                    title.push_str(&e.unescape().unwrap().into_owned());
                } else if recording_text {
                    text.push_str(&e.unescape().unwrap().into_owned());
                }
            }
            Ok(Event::Empty(e)) => {
                if e.name().0 == b"redirect" {
                    redirect = e
                        .attributes()
                        .filter_map(|r| r.ok())
                        .find(|attr| attr.key.0 == b"title")
                        .map(|attr| String::from_utf8_lossy(&attr.value).to_string());
                }
            }
            Ok(Event::End(e)) => {
                if e.name().0 == b"title" {
                    recording_title = false;
                } else if e.name().0 == b"text" {
                    recording_text = false;
                } else if e.name().0 == b"page" {
                    callback(
                        &title,
                        Some(text.as_str()).filter(|text| !text.is_empty()),
                        redirect.as_deref(),
                    )?;
                    redirect = None;
                }
            }
            _ => {}
        }
        buf.clear();
    }
    Ok(())
}
