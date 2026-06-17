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
//! ## Energy model
//! - `LINLOG` (default on): selects the LinLog / ForceAtlas2-style energy
//!   model. Edge attraction grows as `log(1+d)` instead of a linear Hooke
//!   spring, and repulsion falls off as `1/d` instead of `1/d²`. This pairing
//!   squeezes intra-cluster distances while opening up inter-cluster gaps, so
//!   communities settle into distinct clumps instead of one uniform hairball.
//!   With `LINLOG=0` the original Fruchterman-Reingold spring model is used.
//! - `REP_DIST_EXP`: repulsion falloff exponent (LinLog defaults to 1.0, FR to
//!   2.0).
//! - `ATTRACT_MIN`: in LinLog, the per-edge attraction weight for a
//!   zero-Jaccard bridge; intra-cluster edges scale up toward 1.0 as Jaccard
//!   → 1, so bridges stretch while communities contract. (In FR mode Jaccard
//!   instead modulates the spring rest length via `BRIDGE_MULT`.)
//!
//! In LinLog mode the isolated set (see `ISO_COMPONENT_MAX`) is laid out
//! deterministically in a ring just outside the connected core after the
//! simulation, rather than being flung out by repulsion + `SPIN`.
//!
//! - `NODE_MIN_DIST`: after the layout is normalized, a collision-relaxation
//!   pass (d3-force `forceCollide` style) pushes apart any nodes closer than
//!   this many world units. It only acts at short range, so it declutters
//!   overlapping genres without flattening the cluster density that conveys
//!   structure. Set to 0 to disable.
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

    fn insert_inner(
        &mut self,
        root: usize,
        pos: [f64; 2],
        node_idx: usize,
        charge: f64,
        depth: usize,
    ) {
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
    ///
    /// `rep_dist_exp` controls the falloff: 2.0 gives classic
    /// Fruchterman-Reingold `1/d²` repulsion, 1.0 gives the LinLog /
    /// ForceAtlas2 `1/d` repulsion that separates clusters more cleanly.
    #[allow(clippy::too_many_arguments)]
    fn compute_repulsion(
        &self,
        root: usize,
        px: f64,
        py: f64,
        repulsion: f64,
        theta: f64,
        rep_dist_exp: f64,
        force: &mut [f64; 2],
    ) {
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
            // f = repulsion * mass / dist^rep_dist_exp, applied along the unit
            // vector (dx/dist, dy/dist). The +1 in the exponent accounts for
            // that normalization.
            let f = repulsion * node.mass / dist.powf(rep_dist_exp);
            force[0] += dx / dist * f;
            force[1] += dy / dist * f;
        } else if !is_leaf {
            for child_idx in node.children.iter().flatten() {
                self.compute_repulsion(*child_idx, px, py, repulsion, theta, rep_dist_exp, force);
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

    // LinLog / ForceAtlas2-style energy model. When enabled, attraction along
    // edges grows logarithmically with distance (instead of the linear Hooke
    // spring) and repulsion falls off as 1/d (instead of 1/d²). This pair is
    // what makes communities separate into distinct clumps instead of a single
    // hairball: intra-cluster distances are squeezed while inter-cluster gaps
    // open up. Jaccard similarity becomes a per-edge attraction *weight* —
    // high-similarity (intra-cluster) edges pull harder, low-similarity bridges
    // pull weakly — rather than modulating a rest length.
    let linlog = env_f64("LINLOG", 1.0) != 0.0;
    let rep_dist_exp = env_f64("REP_DIST_EXP", if linlog { 1.0 } else { 2.0 });
    // Minimum attraction weight for a zero-Jaccard bridge edge; intra-cluster
    // edges scale up toward 1.0 as Jaccard → 1.
    let attract_min = env_f64("ATTRACT_MIN", 0.25);

    // Repulsion is ~d weaker in LinLog (1/d vs 1/d²), so it needs a much
    // smaller constant to balance the gentler log attraction.
    let repulsion = env_f64("REPULSION", if linlog { 350.0 } else { 170000.0 });
    let theta = env_f64("THETA", 0.8);
    let link_spring = env_f64("LINK_SPRING", if linlog { 250.0 } else { 28.0 });
    let link_distance = env_f64("LINK_DISTANCE", 10.0);
    // Gravity is a weak linear pull toward the origin. LinLog needs only a
    // gentle centering force — just enough to keep the layout from drifting
    // apart — so communities can spread instead of being crushed into a disc.
    let gravity = env_f64("GRAVITY", if linlog { 0.04 } else { 0.75 });
    let gravity_isolated = env_f64("GRAVITY_ISOLATED", if linlog { 0.15 } else { 1.10 });
    let spin = env_f64("SPIN", 25.0);
    let friction = env_f64("FRICTION", 0.85);
    let iterations = env_usize("ITERATIONS", if linlog { 5000 } else { 2000 });
    let max_velocity = env_f64("MAX_VELOCITY", 25.0);
    // LinLog separates clusters while warm, then needs a firmer freeze to lock
    // the knots in place instead of letting them relax back toward a uniform
    // disc, so it cools harder than the FR default.
    let cooling_rate = env_f64("COOLING_RATE", if linlog { 2.0 } else { 0.8 });
    let charge_exponent = env_f64("CHARGE_EXP", 1.2);
    let spring_norm = env_f64("SPRING_NORM", 0.5);
    let bridge_mult = env_f64("BRIDGE_MULT", 7.0);
    let isolated_charge = env_f64("ISO_CHARGE", 0.2);
    let base_charge = env_f64("BASE_CHARGE", 1.0);

    let node_min_dist = env_f64("NODE_MIN_DIST", 28.0);
    eprintln!(
        "  linlog={linlog} rep_dist_exp={rep_dist_exp} attract_min={attract_min} node_min_dist={node_min_dist}"
    );
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
    let (is_isolated, component_id, component_size) = {
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
        (isolated, component_id, component_size)
    };

    // Pre-compute per-edge Jaccard similarity: |N(u)∩N(v)| / |N(u)∪N(v)|.
    // High similarity → intra-cluster edge (short rest length)
    // Low similarity → inter-cluster bridge (long rest length)
    let edge_jaccard: Vec<f64> = adjacency
        .iter()
        .map(|&(src, tgt)| {
            let intersection = neighbors[src].intersection(&neighbors[tgt]).count();
            let union = neighbors[src].union(&neighbors[tgt]).count();
            if union == 0 {
                0.0
            } else {
                intersection as f64 / union as f64
            }
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
                tree.compute_repulsion(
                    root,
                    positions[i][0],
                    positions[i][1],
                    repulsion,
                    theta,
                    rep_dist_exp,
                    &mut force,
                );
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
            let jaccard = edge_jaccard[edge_idx];
            let f = if linlog {
                // LinLog attraction: force grows as log(1+d), always pulling
                // endpoints together (repulsion sets the equilibrium spacing).
                // Jaccard scales the pull: bridges (jaccard≈0) attract weakly
                // at `attract_min`, intra-cluster edges (jaccard→1) attract at
                // full strength, so communities contract while bridges stretch.
                let weight = attract_min + (1.0 - attract_min) * jaccard;
                link_spring * weight * (1.0 + dist).ln()
            } else {
                // Hooke spring toward a Jaccard-modulated rest length.
                // Jaccard=1 → rest_length = link_distance (tight cluster)
                // Jaccard=0 → rest_length = link_distance * bridge_mult (bridge)
                let rest_length = link_distance * (bridge_mult - (bridge_mult - 1.0) * jaccard);
                link_spring * (dist - rest_length)
            };
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
            let (gx, gy) = (-positions[i][0] * g, -positions[i][1] * g);

            let fx = (repulsive_forces[i][0] + spring_forces[i][0] + gx) * temperature;
            let fy = (repulsive_forces[i][1] + spring_forces[i][1] + gy) * temperature;

            velocities[i][0] = clamp_abs((velocities[i][0] + fx) * friction, max_vel);
            velocities[i][1] = clamp_abs((velocities[i][1] + fy) * friction, max_vel);

            // Tangential spin for isolated nodes (FR mode only — in LinLog the
            // isolated set is arranged into a deterministic ring after the
            // simulation, so it doesn't need the orbital spin treatment).
            if is_isolated[i] && !linlog {
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

    // In LinLog mode the weak 1/d repulsion can't fling the isolated set out
    // into an orbiting ring the way the old FR forces did, so they pile up near
    // the center. Their positions carry no edge information, so we instead lay
    // them out deterministically in a tidy ring just outside the connected
    // core — matching the "halo of disconnected genres" look from cosmograph.
    if linlog {
        place_isolated_ring(&mut positions, &is_isolated, &component_id, &component_size);

        // LinLog's coordinate scale is arbitrary (and ~10× larger than the old
        // FR layout). The frontend's world-unit constants — node sizes, edge
        // widths, arrow spacing, fit radii — are all tuned against the historic
        // scale, so rescale the connected core to a fixed positional std before
        // emitting. This keeps the new layout a drop-in replacement.
        let target_std = env_f64("NORM_STD", 850.0);
        let connected: Vec<&[f64; 2]> = positions
            .iter()
            .enumerate()
            .filter(|&(i, _)| !is_isolated[i])
            .map(|(_, p)| p)
            .collect();
        if !connected.is_empty() {
            let n = connected.len() as f64;
            let mean_sq = connected
                .iter()
                .map(|p| p[0] * p[0] + p[1] * p[1])
                .sum::<f64>()
                / n;
            // RMS radius about the (already centered) origin.
            let rms = mean_sq.sqrt();
            if rms > 1e-6 {
                let scale = target_std / rms;
                for pos in positions.iter_mut() {
                    pos[0] *= scale;
                    pos[1] *= scale;
                }
            }
        }

        // Collision relaxation (à la d3-force's forceCollide): nudge apart any
        // pair of nodes closer than NODE_MIN_DIST world units. This only acts
        // at short range, so it declutters overlapping genres without disturbing
        // the cluster structure the main simulation produced. Operates on the
        // already-normalized scale, so the distance is in final world units.
        relax_collisions(&mut positions, node_min_dist);
    }

    positions
}

/// Push apart any nodes closer than `min_dist`, iterating a fixed number of
/// times. Uses a uniform spatial grid (cell size = `min_dist`) so each node
/// only tests the 3×3 block of cells around it — O(n) per pass.
fn relax_collisions(positions: &mut [[f64; 2]], min_dist: f64) {
    if min_dist <= 0.0 || positions.len() < 2 {
        return;
    }
    const PASSES: usize = 60;
    let cell = min_dist;
    let min_sq = min_dist * min_dist;
    for _ in 0..PASSES {
        // Bin nodes into a hash grid keyed by integer cell coordinates.
        use std::collections::HashMap;
        let mut grid: HashMap<(i64, i64), Vec<usize>> = HashMap::new();
        for (i, p) in positions.iter().enumerate() {
            let key = ((p[0] / cell).floor() as i64, (p[1] / cell).floor() as i64);
            grid.entry(key).or_default().push(i);
        }
        let mut moved = false;
        for (&(cx, cy), members) in &grid {
            for dy in -1..=1 {
                for dx in -1..=1 {
                    let Some(others) = grid.get(&(cx + dx, cy + dy)) else {
                        continue;
                    };
                    for &i in members {
                        for &j in others {
                            // Each unordered pair handled once.
                            if j <= i {
                                continue;
                            }
                            let ddx = positions[j][0] - positions[i][0];
                            let ddy = positions[j][1] - positions[i][1];
                            let d_sq = ddx * ddx + ddy * ddy;
                            if d_sq >= min_sq || d_sq < 1e-9 {
                                continue;
                            }
                            let d = d_sq.sqrt();
                            // Split the needed separation evenly between the two.
                            let push = (min_dist - d) * 0.5;
                            let (ux, uy) = (ddx / d, ddy / d);
                            positions[i][0] -= ux * push;
                            positions[i][1] -= uy * push;
                            positions[j][0] += ux * push;
                            positions[j][1] += uy * push;
                            moved = true;
                        }
                    }
                }
            }
        }
        if !moved {
            break;
        }
    }
}

/// Arrange the isolated set (degree-0 nodes and members of tiny components)
/// into an even ring just outside the connected core. Each small component is
/// given one angular slot so its members stay clustered together.
fn place_isolated_ring(
    positions: &mut [[f64; 2]],
    is_isolated: &[bool],
    component_id: &[usize],
    component_size: &[usize],
) {
    // Radius of the connected core: the largest distance from the origin among
    // non-isolated nodes (positions are already centered on the origin).
    let core_radius = positions
        .iter()
        .enumerate()
        .filter(|&(i, _)| !is_isolated[i])
        .map(|(_, p)| (p[0] * p[0] + p[1] * p[1]).sqrt())
        .fold(0.0_f64, f64::max);
    let ring_radius = if core_radius > 0.0 {
        core_radius * 1.12
    } else {
        100.0
    };

    // Group isolated nodes by component, preserving a stable order.
    use std::collections::BTreeMap;
    let mut groups: BTreeMap<usize, Vec<usize>> = BTreeMap::new();
    for (i, &iso) in is_isolated.iter().enumerate() {
        if iso {
            groups.entry(component_id[i]).or_default().push(i);
        }
    }
    if groups.is_empty() {
        return;
    }

    let num_slots = groups.len();
    // Golden-angle increment gives a small deterministic radial wobble so the
    // ring reads as an organic halo rather than a mechanically perfect circle.
    let golden = std::f64::consts::PI * (3.0 - 5.0_f64.sqrt());
    for (slot, (&cid, members)) in groups.iter().enumerate() {
        let angle = std::f64::consts::TAU * slot as f64 / num_slots as f64;
        let wobble = 1.0 + 0.06 * (golden * slot as f64).sin();
        let r = ring_radius * wobble;
        let (ax, ay) = (r * angle.cos(), r * angle.sin());
        let size = component_size[cid].max(1);
        if size == 1 {
            positions[members[0]] = [ax, ay];
        } else {
            // Spread a multi-node component in a small circle around its anchor
            // so its internal edges stay legible.
            let cluster_r = ring_radius * 0.03;
            for (k, &node) in members.iter().enumerate() {
                let a = std::f64::consts::TAU * k as f64 / members.len() as f64;
                positions[node] = [ax + cluster_r * a.cos(), ay + cluster_r * a.sin()];
            }
        }
    }
}
