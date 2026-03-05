//! Color propagation for the genre graph.
//!
//! Assigns hues to nodes so that influential hub genres get distinct base colors
//! and their descendants inherit similar hues, making genre families visually
//! identifiable. The algorithm:
//!
//! 1. Rank nodes by total degree (in + out).
//! 2. Assign the top-K seeds evenly-spaced hues via golden angle spacing.
//! 3. Iteratively relax non-seed nodes toward the degree-weighted circular
//!    mean of their parents' hues (higher-degree parents pull harder).
//! 4. Fall back to a deterministic hash for any remaining uncolored nodes.
//!
//! ## Environment variables
//!
//! - `COLOR_SEEDS`: number of seed nodes (default 20)
//! - `COLOR_MAX_ITERS`: maximum relaxation passes (default 50)
//! - `COLOR_TOLERANCE`: convergence threshold in degrees (default 0.5)

/// Golden angle in degrees — maximizes perceptual separation between successive
/// seed hues.
const GOLDEN_ANGLE: f64 = 137.507_764;

fn env_f64(name: &str, default: f64) -> f64 {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn env_usize(name: &str, default: usize) -> usize {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

/// Compute the weighted circular mean of hues (0–360).
///
/// Each `(hue, weight)` pair contributes proportionally to the result.
/// Uses atan2 on summed unit vectors so that wrapping is handled correctly
/// (e.g. averaging 350° and 10° yields ≈0°, not 180°).
fn weighted_circular_mean_hue(hues_and_weights: &[(f64, f64)]) -> f64 {
    let (sin_sum, cos_sum) =
        hues_and_weights
            .iter()
            .fold((0.0_f64, 0.0_f64), |(s, c), &(h, w)| {
                let r = h.to_radians();
                (s + w * r.sin(), c + w * r.cos())
            });
    let mean = sin_sum.atan2(cos_sum).to_degrees();
    if mean < 0.0 {
        mean + 360.0
    } else {
        mean
    }
}

/// Deterministic fallback hue for isolated / unreached nodes.
fn fallback_hue(index: usize) -> f64 {
    // Simple but effective: multiply by golden angle for good distribution
    (index as f64 * GOLDEN_ANGLE) % 360.0
}

/// Shortest signed angular distance from `a` to `b` on a 0–360 circle.
fn angular_distance(a: f64, b: f64) -> f64 {
    let d = (b - a).rem_euclid(360.0);
    if d > 180.0 {
        d - 360.0
    } else {
        d
    }
}

/// Compute a hue (0–360) for every node in the graph.
///
/// `edges` contains `(source, target)` index pairs. The returned `Vec` is
/// indexed by node index and contains the assigned hue for each node.
pub fn compute_hues(num_nodes: usize, edges: &[(usize, usize)]) -> Vec<f64> {
    compute_hues_with_params(
        num_nodes,
        edges,
        env_usize("COLOR_SEEDS", 20),
        env_usize("COLOR_MAX_ITERS", 50),
        env_f64("COLOR_TOLERANCE", 0.5),
    )
}

fn compute_hues_with_params(
    num_nodes: usize,
    edges: &[(usize, usize)],
    num_seeds: usize,
    max_iters: usize,
    tolerance: f64,
) -> Vec<f64> {
    // 1. Compute total degree per node
    let mut degree = vec![0usize; num_nodes];
    // Build adjacency: for each node, which nodes point *to* it (parents)
    let mut parents: Vec<Vec<usize>> = vec![vec![]; num_nodes];
    for &(src, tgt) in edges {
        degree[src] += 1;
        degree[tgt] += 1;
        parents[tgt].push(src);
    }

    // 2. Select top-K seed nodes by degree
    let mut ranked: Vec<usize> = (0..num_nodes).collect();
    ranked.sort_unstable_by(|&a, &b| degree[b].cmp(&degree[a]));
    let seeds: Vec<usize> = ranked.into_iter().take(num_seeds).collect();

    // 3. Assign seed hues with golden angle spacing
    let mut hue: Vec<Option<f64>> = vec![None; num_nodes];
    for (i, &node) in seeds.iter().enumerate() {
        hue[node] = Some((i as f64 * GOLDEN_ANGLE) % 360.0);
    }

    // 4. Iterative relaxation
    for _ in 0..max_iters {
        let mut max_change = 0.0_f64;

        for node in 0..num_nodes {
            if seeds.contains(&node) {
                continue; // seeds are fixed
            }

            let parent_hues_and_weights: Vec<(f64, f64)> = parents[node]
                .iter()
                .filter_map(|&p| hue[p].map(|h| (h, degree[p] as f64)))
                .collect();

            if parent_hues_and_weights.is_empty() {
                continue;
            }

            let new_hue = weighted_circular_mean_hue(&parent_hues_and_weights);

            if let Some(old) = hue[node] {
                max_change = max_change.max(angular_distance(old, new_hue).abs());
            } else {
                max_change = max_change.max(360.0); // first assignment
            }

            hue[node] = Some(new_hue);
        }

        if max_change < tolerance {
            break;
        }
    }

    // 5. Fallback for uncolored nodes
    (0..num_nodes)
        .map(|i| hue[i].unwrap_or_else(|| fallback_hue(i)))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn circular_mean_wraps_correctly() {
        // 350° and 10° should average to ≈0°, not 180°
        let mean = weighted_circular_mean_hue(&[(350.0, 1.0), (10.0, 1.0)]);
        assert!(mean < 5.0 || mean > 355.0, "got {mean}");
    }

    #[test]
    fn isolated_nodes_get_fallback_hues() {
        let hues = compute_hues_with_params(5, &[], 20, 50, 0.5);
        for &h in &hues {
            assert!((0.0..360.0).contains(&h));
        }
        // All hues should be distinct (golden angle spacing)
        for i in 0..hues.len() {
            for j in (i + 1)..hues.len() {
                assert!((hues[i] - hues[j]).abs() > 0.01);
            }
        }
    }

    #[test]
    fn child_inherits_parent_hue() {
        // Linear chain: 0 -> 1 -> 2 -> 3, with only node 0 as a seed.
        let edges = vec![(0, 1), (1, 2), (2, 3)];
        let hues = compute_hues_with_params(4, &edges, 1, 50, 0.5);
        // All nodes should inherit node 0's hue down the chain
        let seed_hue = hues[0];
        for (i, &h) in hues.iter().enumerate().skip(1) {
            assert!(
                angular_distance(seed_hue, h).abs() < 1.0,
                "hues[0]={seed_hue}, hues[{i}]={h}"
            );
        }
    }

    #[test]
    fn fusion_gets_degree_weighted_blend() {
        // Node 0 has degree 4 (edges to 2,3,4,5), node 1 has degree 2 (edges to 5,6).
        // Both point to node 5, which should blend toward node 0's hue due to
        // higher degree weight.
        // 0 -> 2, 0 -> 3, 0 -> 4, 0 -> 5
        // 1 -> 5, 1 -> 6
        let edges = vec![(0, 2), (0, 3), (0, 4), (0, 5), (1, 5), (1, 6)];
        let hues = compute_hues_with_params(7, &edges, 2, 50, 0.5);
        // Node 5 should get a degree-weighted circular mean: node 0 (weight 4)
        // and node 1 (weight 2).
        let expected =
            weighted_circular_mean_hue(&[(hues[0], 4.0), (hues[1], 2.0)]);
        assert!(
            angular_distance(expected, hues[5]).abs() < 1.0,
            "expected≈{expected}, got hues[5]={}",
            hues[5]
        );
        // The result should be closer to node 0's hue than node 1's
        assert!(
            angular_distance(hues[0], hues[5]).abs()
                < angular_distance(hues[1], hues[5]).abs(),
            "should be closer to hues[0]={} than hues[1]={}, got hues[5]={}",
            hues[0],
            hues[1],
            hues[5]
        );
    }
}
