//! Barnes-Hut force-directed graph layout.
//!
//! Computes 2D positions for graph nodes using:
//! - Quadtree-based Barnes-Hut approximation for O(n log n) repulsion
//! - Jaccard-weighted spring forces along edges (community-aware attraction)
//! - Gravity pulling toward center
//! - Velocity integration with friction damping and exponential cooling
//!
//! All layout parameters can be overridden via environment variables for
//! tuning (see `sweep_layout.sh` for examples). Key parameters:
//!
//! ## Repulsion
//! - `REPULSION`: Global repulsive force strength.
//! - `THETA`: Barnes-Hut opening angle. Lower = more accurate but slower.
//! - `BASE_CHARGE`: Minimum charge for connected nodes (default 3). Higher
//!   values ensure even low-degree nodes repel each other enough to avoid
//!   clumping.
//! - `CHARGE_EXP`: Degree-charge exponent. Each node's charge in the
//!   quadtree is `BASE_CHARGE + degree^exp`. Values >1 make hubs repel
//!   super-linearly, creating visible voids between major clusters.
//! - `ISO_CHARGE`: Fixed charge for isolated (degree-0) nodes. Low values
//!   reduce how much the connected core pushes them away, so the outer ring
//!   orbits closer.
//!
//! ## Springs (edge attraction)
//! - `LINK_SPRING`: Spring constant (Hooke's law).
//! - `LINK_DISTANCE`: Base rest length for intra-cluster edges.
//! - `BRIDGE_MULT`: Jaccard bridge multiplier. Each edge's rest length is
//!   `LINK_DISTANCE * (BRIDGE_MULT - (BRIDGE_MULT-1) * jaccard)`, so edges
//!   between nodes sharing many neighbors (high Jaccard) pull tight, while
//!   inter-community bridges (low Jaccard) have up to `BRIDGE_MULT`× the
//!   rest length. This is the single biggest contributor to cluster visibility.
//! - `SPRING_NORM`: Per-endpoint force is divided by `degree^SPRING_NORM`,
//!   so hub nodes aren't yanked equally hard by every edge.
//!
//! ## Gravity & isolated-node handling
//! - `GRAVITY`: Gravity strength for connected nodes (pulls toward origin).
//! - `GRAVITY_ISOLATED`: Gravity for isolated nodes (stronger = tighter ring).
//! - `SPIN`: Tangential velocity added to isolated nodes so they distribute
//!   around the ring instead of clumping. Scales with distance from origin.
//! - `ISO_COMPONENT_MAX`: Maximum component size to treat as "isolated".
//!   Nodes in components with at most this many members get the isolated
//!   treatment (reduced charge, stronger gravity, spin).
//!
//! ## Simulation
//! - `ITERATIONS`: Total simulation steps.
//! - `COOLING_RATE`: Exponential cooling: `temperature = exp(-rate * t)`.
//!   Lower values keep the simulation warm longer, giving clusters more time
//!   to separate before freezing.
//! - `FRICTION`: Velocity damping per step.
//! - `MAX_VELOCITY`: Velocity clamp (scaled by temperature).

use rayon::prelude::*;

// Layout constants (overridable via environment variables for tuning)
fn env_f64(name: &str, default: f64) -> f64 {
    std::env::var(name).ok().and_then(|v| v.parse().ok()).unwrap_or(default)
}
fn env_usize(name: &str, default: usize) -> usize {
    std::env::var(name).ok().and_then(|v| v.parse().ok()).unwrap_or(default)
}

const MAX_TREE_DEPTH: usize = 40;

/// A node in the quadtree, either a leaf or an internal node with up to 4 children.
struct QuadTree {
    /// Center of mass x
    cx: f64,
    /// Center of mass y
    cy: f64,
    /// Total mass (number of nodes)
    mass: f64,
    /// Bounding box: min_x, min_y, max_x, max_y
    bounds: [f64; 4],
    /// Children: NW, NE, SW, SE (indices into arena)
    children: [Option<usize>; 4],
    /// If leaf, the node index
    node_index: Option<usize>,
}

struct QuadTreeArena {
    nodes: Vec<QuadTree>,
}

impl QuadTreeArena {
    fn new(capacity: usize) -> Self {
        Self {
            nodes: Vec::with_capacity(capacity),
        }
    }

    fn alloc(&mut self, bounds: [f64; 4]) -> usize {
        let idx = self.nodes.len();
        self.nodes.push(QuadTree {
            cx: 0.0,
            cy: 0.0,
            mass: 0.0,
            bounds,
            children: [None; 4],
            node_index: None,
        });
        idx
    }

    fn insert(&mut self, root: usize, pos: [f64; 2], node_idx: usize, charge: f64) {
        self.insert_inner(root, pos, node_idx, charge, 0);
    }

    fn insert_inner(&mut self, root: usize, pos: [f64; 2], node_idx: usize, charge: f64, depth: usize) {
        if depth >= MAX_TREE_DEPTH {
            // At max depth, just accumulate mass
            let m = self.nodes[root].mass;
            if m == 0.0 {
                self.nodes[root].cx = pos[0];
                self.nodes[root].cy = pos[1];
                self.nodes[root].mass = charge;
            } else {
                self.nodes[root].cx = (self.nodes[root].cx * m + pos[0] * charge) / (m + charge);
                self.nodes[root].cy = (self.nodes[root].cy * m + pos[1] * charge) / (m + charge);
                self.nodes[root].mass = m + charge;
            }
            return;
        }

        let [min_x, min_y, max_x, max_y] = self.nodes[root].bounds;

        // If empty leaf, place here
        if self.nodes[root].mass == 0.0 {
            self.nodes[root].cx = pos[0];
            self.nodes[root].cy = pos[1];
            self.nodes[root].mass = charge;
            self.nodes[root].node_index = Some(node_idx);
            return;
        }

        // If leaf with existing node, subdivide
        if let Some(_existing_idx) = self.nodes[root].node_index {
            let existing_pos = [self.nodes[root].cx, self.nodes[root].cy];
            let existing_mass = self.nodes[root].mass;
            self.nodes[root].node_index = None;
            self.insert_into_quadrant(root, existing_pos, _existing_idx, existing_mass, depth);
        }

        // Update center of mass (weighted by charge)
        let m = self.nodes[root].mass;
        self.nodes[root].cx = (self.nodes[root].cx * m + pos[0] * charge) / (m + charge);
        self.nodes[root].cy = (self.nodes[root].cy * m + pos[1] * charge) / (m + charge);
        self.nodes[root].mass = m + charge;

        // Insert into appropriate quadrant
        let mid_x = (min_x + max_x) / 2.0;
        let mid_y = (min_y + max_y) / 2.0;
        let quadrant = if pos[0] <= mid_x {
            if pos[1] <= mid_y { 0 } else { 2 }
        } else if pos[1] <= mid_y {
            1
        } else {
            3
        };

        let child_bounds = quadrant_bounds([min_x, min_y, max_x, max_y], quadrant);
        if self.nodes[root].children[quadrant].is_none() {
            let child = self.alloc(child_bounds);
            self.nodes[root].children[quadrant] = Some(child);
        }
        let child = self.nodes[root].children[quadrant].unwrap();
        self.insert_inner(child, pos, node_idx, charge, depth + 1);
    }

    fn insert_into_quadrant(
        &mut self,
        root: usize,
        pos: [f64; 2],
        node_idx: usize,
        charge: f64,
        depth: usize,
    ) {
        let [min_x, min_y, max_x, max_y] = self.nodes[root].bounds;
        let mid_x = (min_x + max_x) / 2.0;
        let mid_y = (min_y + max_y) / 2.0;
        let quadrant = if pos[0] <= mid_x {
            if pos[1] <= mid_y { 0 } else { 2 }
        } else if pos[1] <= mid_y {
            1
        } else {
            3
        };

        let child_bounds = quadrant_bounds([min_x, min_y, max_x, max_y], quadrant);
        if self.nodes[root].children[quadrant].is_none() {
            let child = self.alloc(child_bounds);
            self.nodes[root].children[quadrant] = Some(child);
        }
        let child = self.nodes[root].children[quadrant].unwrap();
        self.insert_inner(child, pos, node_idx, charge, depth + 1);
    }

    /// Compute repulsive force on a node from the tree.
    fn compute_repulsion(&self, root: usize, px: f64, py: f64, repulsion: f64, theta: f64, force: &mut [f64; 2]) {
        let node = &self.nodes[root];
        if node.mass == 0.0 {
            return;
        }

        let dx = px - node.cx;
        let dy = py - node.cy;
        let dist_sq = dx * dx + dy * dy;

        let [min_x, _, max_x, _] = node.bounds;
        let size = max_x - min_x;

        let is_leaf = node.children.iter().all(|c| c.is_none());
        let is_far = size * size < theta * theta * dist_sq;

        if (is_leaf || is_far) && dist_sq > 1e-6 {
            let dist = dist_sq.sqrt().max(1.0);
            let f = repulsion * node.mass / (dist * dist);
            force[0] += dx / dist * f;
            force[1] += dy / dist * f;
        } else if !is_leaf {
            for child_idx in node.children.iter().flatten() {
                self.compute_repulsion(*child_idx, px, py, repulsion, theta, force);
            }
        }
    }
}

fn quadrant_bounds(bounds: [f64; 4], quadrant: usize) -> [f64; 4] {
    let [min_x, min_y, max_x, max_y] = bounds;
    let mid_x = (min_x + max_x) / 2.0;
    let mid_y = (min_y + max_y) / 2.0;
    match quadrant {
        0 => [min_x, min_y, mid_x, mid_y], // NW
        1 => [mid_x, min_y, max_x, mid_y], // NE
        2 => [min_x, mid_y, mid_x, max_y], // SW
        3 => [mid_x, mid_y, max_x, max_y], // SE
        _ => unreachable!(),
    }
}

/// Clamp a value to [-limit, limit].
fn clamp_abs(v: f64, limit: f64) -> f64 {
    v.clamp(-limit, limit)
}

/// Compute force-directed layout positions for graph nodes.
///
/// `adjacency` is a list of `(source, target)` pairs.
/// Returns positions as `Vec<[f64; 2]>` with one entry per node.
pub fn compute(num_nodes: usize, adjacency: &[(usize, usize)]) -> Vec<[f64; 2]> {
    if num_nodes == 0 {
        return vec![];
    }

    let repulsion = env_f64("REPULSION", 170000.0);
    let theta = env_f64("THETA", 0.8);
    let link_spring = env_f64("LINK_SPRING", 28.0);
    let link_distance = env_f64("LINK_DISTANCE", 10.0);
    let gravity = env_f64("GRAVITY", 0.75);
    let gravity_isolated = env_f64("GRAVITY_ISOLATED", 1.10);
    let spin = env_f64("SPIN", 25.0);
    let friction = env_f64("FRICTION", 0.85);
    let iterations = env_usize("ITERATIONS", 50000);
    let max_velocity = env_f64("MAX_VELOCITY", 25.0);
    let cooling_rate = env_f64("COOLING_RATE", 0.8);
    let charge_exponent = env_f64("CHARGE_EXP", 1.2);
    let spring_norm = env_f64("SPRING_NORM", 0.5);
    let bridge_mult = env_f64("BRIDGE_MULT", 7.0);
    let isolated_charge = env_f64("ISO_CHARGE", 0.2);
    let base_charge = env_f64("BASE_CHARGE", 1.0);

    eprintln!("  repulsion={repulsion} theta={theta} spring={link_spring} dist={link_distance}");
    eprintln!("  gravity={gravity} gravity_iso={gravity_isolated} spin={spin}");
    eprintln!("  friction={friction} iterations={iterations} cooling={cooling_rate}");
    eprintln!("  charge_exp={charge_exponent} spring_norm={spring_norm} base_charge={base_charge}");

    // Compute node degrees and adjacency lists for Jaccard similarity
    let mut degrees = vec![0u32; num_nodes];
    let mut neighbors: Vec<std::collections::HashSet<usize>> = vec![Default::default(); num_nodes];
    for &(src, tgt) in adjacency {
        degrees[src] += 1;
        degrees[tgt] += 1;
        neighbors[src].insert(tgt);
        neighbors[tgt].insert(src);
    }

    // Connected components via BFS — nodes in small components get isolated
    // treatment (stronger gravity, reduced charge, spin) so they orbit near
    // the core instead of being flung outside the isolated ring.
    let iso_component_max = env_usize("ISO_COMPONENT_MAX", 5);
    let is_isolated = {
        let mut component_id = vec![usize::MAX; num_nodes];
        let mut current_id = 0usize;
        for start in 0..num_nodes {
            if component_id[start] != usize::MAX {
                continue;
            }
            let mut queue = std::collections::VecDeque::new();
            queue.push_back(start);
            component_id[start] = current_id;
            while let Some(node) = queue.pop_front() {
                for &nbr in &neighbors[node] {
                    if component_id[nbr] == usize::MAX {
                        component_id[nbr] = current_id;
                        queue.push_back(nbr);
                    }
                }
            }
            current_id += 1;
        }
        // Count component sizes
        let mut component_size = vec![0usize; current_id];
        for &cid in &component_id {
            component_size[cid] += 1;
        }
        // A node is "isolated" if its component has <= iso_component_max nodes
        let isolated: Vec<bool> = (0..num_nodes)
            .map(|i| component_size[component_id[i]] <= iso_component_max)
            .collect();
        isolated
    };

    // Pre-compute per-edge Jaccard similarity: |N(u)∩N(v)| / |N(u)∪N(v)|.
    // High similarity → intra-cluster edge (short rest length)
    // Low similarity → inter-cluster bridge (long rest length)
    let edge_jaccard: Vec<f64> = adjacency
        .iter()
        .map(|&(src, tgt)| {
            let intersection = neighbors[src].intersection(&neighbors[tgt]).count();
            let union = neighbors[src].union(&neighbors[tgt]).count();
            if union == 0 { 0.0 } else { intersection as f64 / union as f64 }
        })
        .collect();

    // Deterministic initial positions: seeded PRNG for uniform random placement
    // Using a simple xorshift64 for reproducibility without extra dependencies.
    let mut rng_state: u64 = 0xDEAD_BEEF_CAFE_BABE;
    let mut next_f64 = || -> f64 {
        rng_state ^= rng_state << 13;
        rng_state ^= rng_state >> 7;
        rng_state ^= rng_state << 17;
        (rng_state as f64) / (u64::MAX as f64) * 2.0 - 1.0
    };
    let spread = (num_nodes as f64).sqrt() * 15.0;

    let mut positions: Vec<[f64; 2]> = (0..num_nodes)
        .map(|_| [next_f64() * spread, next_f64() * spread])
        .collect();

    let mut velocities = vec![[0.0_f64; 2]; num_nodes];

    for iter in 0..iterations {
        let temperature = (-cooling_rate * iter as f64 / iterations as f64).exp();

        // Build quadtree
        let (min_x, min_y, max_x, max_y) = positions.iter().fold(
            (f64::MAX, f64::MAX, f64::MIN, f64::MIN),
            |(min_x, min_y, max_x, max_y), p| {
                (
                    min_x.min(p[0]),
                    min_y.min(p[1]),
                    max_x.max(p[0]),
                    max_y.max(p[1]),
                )
            },
        );
        let padding = 1.0;
        // Estimate tree capacity: ~4x nodes for a balanced quadtree
        let mut tree = QuadTreeArena::new(num_nodes * 4);
        let root = tree.alloc([
            min_x - padding,
            min_y - padding,
            max_x + padding,
            max_y + padding,
        ]);
        let charges: Vec<f64> = (0..num_nodes)
            .map(|i| {
                // Degree-weighted charge: hub nodes repel more strongly,
                // creating natural voids between clusters.
                // Isolated nodes get a reduced charge so they orbit closer to core.
                if is_isolated[i] {
                    isolated_charge
                } else {
                    base_charge + (degrees[i] as f64).powf(charge_exponent)
                }
            })
            .collect();
        for (i, pos) in positions.iter().enumerate() {
            tree.insert(root, *pos, i, charges[i]);
        }

        // Compute repulsive forces (parallel)
        let repulsive_forces: Vec<[f64; 2]> = (0..num_nodes)
            .into_par_iter()
            .map(|i| {
                let mut force = [0.0, 0.0];
                tree.compute_repulsion(root, positions[i][0], positions[i][1], repulsion, theta, &mut force);
                force
            })
            .collect();

        // Compute spring forces along edges (sequential accumulation).
        // Rest length is modulated by Jaccard similarity: edges between nodes
        // that share many neighbors (intra-cluster) get shorter rest lengths,
        // while bridge edges (low similarity) get longer rest lengths.
        let mut spring_forces = vec![[0.0_f64; 2]; num_nodes];
        for (edge_idx, &(src, tgt)) in adjacency.iter().enumerate() {
            let dx = positions[tgt][0] - positions[src][0];
            let dy = positions[tgt][1] - positions[src][1];
            let dist = (dx * dx + dy * dy).sqrt().max(0.1);
            // Jaccard=1 → rest_length = link_distance (tight cluster)
            // Jaccard=0 → rest_length = link_distance * bridge_mult (loose bridge)
            let jaccard = edge_jaccard[edge_idx];
            let rest_length = link_distance * (bridge_mult - (bridge_mult - 1.0) * jaccard);
            let displacement = dist - rest_length;
            let f = link_spring * displacement;
            let fx = dx / dist * f;
            let fy = dy / dist * f;
            // Weight by inverse degree^spring_norm so hubs aren't yanked as hard
            let src_weight = 1.0 / (degrees[src] as f64).max(1.0).powf(spring_norm);
            let tgt_weight = 1.0 / (degrees[tgt] as f64).max(1.0).powf(spring_norm);
            spring_forces[src][0] += fx * src_weight;
            spring_forces[src][1] += fy * src_weight;
            spring_forces[tgt][0] -= fx * tgt_weight;
            spring_forces[tgt][1] -= fy * tgt_weight;
        }

        // Integrate forces
        let max_vel = max_velocity * temperature;
        for i in 0..num_nodes {
            let g = if is_isolated[i] {
                gravity_isolated
            } else {
                gravity
            };
            let gx = -positions[i][0] * g;
            let gy = -positions[i][1] * g;

            let fx = (repulsive_forces[i][0] + spring_forces[i][0] + gx) * temperature;
            let fy = (repulsive_forces[i][1] + spring_forces[i][1] + gy) * temperature;

            velocities[i][0] = clamp_abs((velocities[i][0] + fx) * friction, max_vel);
            velocities[i][1] = clamp_abs((velocities[i][1] + fy) * friction, max_vel);

            // Tangential spin for isolated nodes
            if is_isolated[i] {
                let dx = positions[i][0];
                let dy = positions[i][1];
                let r = (dx * dx + dy * dy).sqrt().max(1.0);
                let tx = -dy / r;
                let ty = dx / r;
                let dist_factor = (r / 200.0).max(0.5);
                let sp = spin * temperature * dist_factor;
                velocities[i][0] += tx * sp;
                velocities[i][1] += ty * sp;
            }

            positions[i][0] += velocities[i][0];
            positions[i][1] += velocities[i][1];
        }

        // Re-center: shift all positions so the center of mass is at the origin.
        // This ensures gravity pulls symmetrically from all directions, which
        // lets isolated nodes form a full orbit instead of a crescent.
        let (com_x, com_y) = {
            let mut sx = 0.0;
            let mut sy = 0.0;
            for pos in positions.iter() {
                sx += pos[0];
                sy += pos[1];
            }
            (sx / num_nodes as f64, sy / num_nodes as f64)
        };
        for pos in positions.iter_mut() {
            pos[0] -= com_x;
            pos[1] -= com_y;
        }

        if iter % 100 == 0 {
            println!("  layout iteration {iter}/{iterations} (temperature: {temperature:.3})");
        }
    }

    positions
}
