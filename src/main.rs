use anyhow::Context;
use quick_xml::events::Event;
use serde::Deserialize;
use std::{
    collections::{HashMap, HashSet},
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

    let output_path = Path::new("output");
    let genres_path = output_path.join("genres");
    let redirects_path = output_path.join("all_redirects.toml");
    let genre_redirects_path = output_path.join("genre_redirects.toml");

    let start = std::time::Instant::now();

    // Stage 1: Extract genres and all redirects
    let (genres, all_redirects) =
        stage1_genre_and_all_redirects(&config, start, &genres_path, &redirects_path)?;

    // Stage 2: Find redirects to genres, looping until we can no longer find any new redirects.
    let genre_redirects =
        stage2_resolve_genre_redirects(start, &genre_redirects_path, &genres, all_redirects)?;

    Ok(())
}

#[derive(Clone, Default)]
struct Genres(pub HashMap<String, PathBuf>);
impl Genres {
    pub fn all<'a>(&'a self) -> impl Iterator<Item = &'a String> {
        self.0.keys()
    }
}

enum AllRedirects {
    InMemory(HashMap<String, String>),
    LazyLoad(PathBuf, std::time::Instant),
}
impl TryFrom<AllRedirects> for HashMap<String, String> {
    type Error = anyhow::Error;
    fn try_from(value: AllRedirects) -> Result<Self, Self::Error> {
        match value {
            AllRedirects::InMemory(value) => Ok(value),
            AllRedirects::LazyLoad(path, start) => {
                let value = toml::from_str(&std::fs::read_to_string(path)?)?;
                println!(
                    "{:.2}s: loaded all redirects",
                    start.elapsed().as_secs_f32()
                );
                Ok(value)
            }
        }
    }
}

fn stage1_genre_and_all_redirects(
    config: &Config,
    start: std::time::Instant,
    genres_path: &Path,
    redirects_path: &Path,
) -> anyhow::Result<(Genres, AllRedirects)> {
    let mut genres = HashMap::default();
    let mut all_redirects = HashMap::<String, String>::default();

    // Already exists, just load from file
    if genres_path.is_dir() && redirects_path.is_file() {
        for entry in std::fs::read_dir(&genres_path)? {
            let path = entry?.path();
            let Some(file_stem) = path.file_stem() else {
                continue;
            };
            genres.insert(
                unsanitize_title_reversible(&file_stem.to_string_lossy()),
                path,
            );
        }
        println!(
            "{:.2}s: loaded all {} genres",
            start.elapsed().as_secs_f32(),
            genres.len()
        );

        return Ok((
            Genres(genres),
            AllRedirects::LazyLoad(redirects_path.to_owned(), start),
        ));
    }

    println!("Genres directory or redirects file does not exist, extracting from Wikipedia dump");

    let now = std::time::Instant::now();
    let mut count = 0;
    std::fs::create_dir_all(&genres_path).context("Failed to create genres directory")?;

    // This could be made much faster by loading the file into memory and using the index to attack
    // the streams in parallel, but this will only run once every month, so it's not worth optimising.
    let file = std::fs::File::open(&config.wikipedia_dump_path)
        .context("Failed to open Wikipedia dump file")?;
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
                } else if name == b"text" {
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
                    if let Some(redirect) = redirect {
                        all_redirects.insert(title.clone(), redirect);

                        count += 1;
                        if count % 1000 == 0 {
                            println!("{:.2}s: {count} redirects", start.elapsed().as_secs_f32());
                        }
                    } else if text.contains("nfobox music genre") {
                        if title.contains(":") {
                            continue;
                        }

                        let path = genres_path
                            .join(format!("{}.wikitext", sanitize_title_reversible(&title)));
                        std::fs::write(&path, &text)
                            .with_context(|| format!("Failed to write genre {title}"))?;

                        genres.insert(title.clone(), path);
                        println!("{:.2}s: {title}", start.elapsed().as_secs_f32());
                    }

                    redirect = None;
                }
            }
            _ => {}
        }
        buf.clear();
    }

    std::fs::write(
        redirects_path,
        toml::to_string_pretty(&all_redirects)?.as_bytes(),
    )
    .context("Failed to write redirects")?;
    println!("Extracted genres and redirects in {:?}", now.elapsed());

    Ok((Genres(genres), AllRedirects::InMemory(all_redirects)))
}

pub struct GenreRedirects(pub HashMap<String, String>);
impl GenreRedirects {
    pub fn find_original<'a>(&'a self, mut page_title: &'a str) -> Option<&'a str> {
        // Only resolve up to n=5 redirects; any more is probably a bug
        const MAX_DEPTH: usize = 5;
        for _ in 0..MAX_DEPTH {
            let new_page_title = self.0.get(page_title);
            match new_page_title {
                Some(new_page_title) => {
                    page_title = new_page_title.as_str();
                }
                None => {
                    return Some(page_title);
                }
            }
        }
        panic!("Exceeded {MAX_DEPTH} resolutions: redirect cycle for '{page_title}'?");
    }
}
fn stage2_resolve_genre_redirects(
    start: std::time::Instant,
    genre_redirects_path: &Path,
    genres: &Genres,
    all_redirects: AllRedirects,
) -> anyhow::Result<GenreRedirects> {
    if genre_redirects_path.is_file() {
        let genre_redirects: HashMap<String, String> =
            toml::from_str(&std::fs::read_to_string(genre_redirects_path)?)?;
        println!(
            "{:.2}s: loaded all {} genre redirects",
            start.elapsed().as_secs_f32(),
            genre_redirects.len()
        );
        return Ok(GenreRedirects(genre_redirects));
    }

    let all_redirects: HashMap<_, _> = all_redirects.try_into()?;

    let now = std::time::Instant::now();

    let mut genre_redirects: HashMap<String, String> = HashMap::default();
    let mut redirect_targets = genres.all().cloned().collect::<HashSet<_>>();

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

    // Save genre redirects to file
    std::fs::write(
        &genre_redirects_path,
        toml::to_string_pretty(&genre_redirects)?.as_bytes(),
    )
    .context("Failed to write genre redirects")?;
    println!("Saved genre redirects in {:?}", now.elapsed());

    Ok(GenreRedirects(genre_redirects))
}
}

fn sanitize_title_reversible(title: &str) -> String {
    title.replace("/", "#")
}
fn unsanitize_title_reversible(title: &str) -> String {
    title.replace("#", "/")
}
