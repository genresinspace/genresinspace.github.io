//! Check that every genre in website/public/genres/ has a corresponding mix file in mixes/.

use std::collections::BTreeSet;
use std::path::Path;

fn main() -> anyhow::Result<()> {
    let genres_path = Path::new("website/public/genres");
    let mixes_path = Path::new("mixes");

    anyhow::ensure!(genres_path.is_dir(), "{genres_path:?} does not exist");
    anyhow::ensure!(mixes_path.is_dir(), "{mixes_path:?} does not exist");

    // Genre JSON files use sanitized page names; unsanitize to get the real page name
    let genres: BTreeSet<shared::PageName> = std::fs::read_dir(genres_path)?
        .filter_map(Result::ok)
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            name.strip_suffix(".json")
                .map(shared::PageName::unsanitize)
        })
        .collect();

    // Mix files also use sanitized page names
    let mixes: BTreeSet<shared::PageName> = std::fs::read_dir(mixes_path)?
        .filter_map(Result::ok)
        .map(|e| shared::PageName::unsanitize(&e.file_name().to_string_lossy()))
        .collect();

    let missing: BTreeSet<_> = genres.difference(&mixes).collect();

    if missing.is_empty() {
        println!("All {} genres have mixes.", genres.len());
        return Ok(());
    }

    println!(
        "{} genre(s) without mixes (out of {}):\n",
        missing.len(),
        genres.len()
    );
    for name in &missing {
        println!("  - {name}");
    }

    std::process::exit(1);
}
