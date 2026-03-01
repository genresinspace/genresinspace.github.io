//! Re-run force layout on existing data.json without needing Wikipedia dumps.

use datagen::frontend_types::{self, FrontendData};

fn main() -> anyhow::Result<()> {
    let data_path = frontend_types::data_json_path();
    let raw = std::fs::read_to_string(data_path)?;
    let mut data: FrontendData = serde_json::from_str(&raw)?;

    let num_nodes = data.nodes.len();
    let adjacency: Vec<(usize, usize)> = data
        .edges
        .iter()
        .map(|e| (e.source.0, e.target.0))
        .collect();

    println!("Nodes: {num_nodes}, Edges: {}", adjacency.len());

    let positions = datagen::force_layout::compute(num_nodes, &adjacency);

    for (node, pos) in data.nodes.iter_mut().zip(positions.iter()) {
        node.x = pos[0];
        node.y = pos[1];
    }

    std::fs::write(data_path, serde_json::to_string_pretty(&data)?)?;
    println!("Updated {data_path:?}");
    Ok(())
}
