//! Check for suspicious genre edges in data.json using a degree-ratio heuristic.
//!
//! Flags Derivative edges where a low-degree source supposedly influences a much
//! higher-degree target, which often indicates an error in a Wikipedia infobox.

use std::collections::BTreeMap;

use datagen::{
    data_patches,
    frontend_types::{self, EdgeType, FrontendData},
    types::GenreName,
};

fn main() -> anyhow::Result<()> {
    let data_path = frontend_types::data_json_path();
    anyhow::ensure!(data_path.exists(), "{data_path:?} does not exist");

    let data: FrontendData = serde_json::from_str(&std::fs::read_to_string(data_path)?)?;

    // Compute degree for each node
    let mut degree: BTreeMap<usize, usize> = BTreeMap::new();
    for edge in &data.edges {
        *degree.entry(edge.source.0).or_default() += 1;
        *degree.entry(edge.target.0).or_default() += 1;
    }

    let rejected = data_patches::edges_to_reject();
    let accepted = data_patches::edges_to_accept();

    let mut flagged = Vec::new();

    for edge in &data.edges {
        if edge.ty != EdgeType::Derivative {
            continue;
        }

        let source_degree = degree.get(&edge.source.0).copied().unwrap_or(0);
        let target_degree = degree.get(&edge.target.0).copied().unwrap_or(0);

        // Only flag when a low-degree node supposedly influences a high-degree node
        if source_degree >= target_degree {
            continue;
        }

        let ratio = target_degree as f64 / source_degree.max(1) as f64;
        if ratio < 5.0 || target_degree < 15 {
            continue;
        }

        let source_name = GenreName(data.nodes[edge.source.0].label.0.clone());
        let target_name = GenreName(data.nodes[edge.target.0].label.0.clone());
        let key = (source_name.clone(), target_name.clone(), EdgeType::Derivative);

        if rejected.contains(&key) || accepted.contains(&key) {
            continue;
        }

        flagged.push((source_name, source_degree, target_name, target_degree, ratio));
    }

    if flagged.is_empty() {
        println!("No unreviewed suspicious edges found.");
        return Ok(());
    }

    println!(
        "{} suspicious edge(s) need review:\n",
        flagged.len()
    );
    for (source, s_deg, target, t_deg, ratio) in &flagged {
        println!(
            "  {} (degree {}) -> {} (degree {}) [{:.1}x ratio]",
            source.0, s_deg, target.0, t_deg, ratio
        );
    }
    println!("\nAdd each edge to edges_to_reject() or edges_to_accept() in data_patches.rs");

    std::process::exit(1);
}
