//! Barnes-Hut force-directed graph layout.
//!
//! Computes 2D positions for graph nodes using:
//! - Quadtree-based Barnes-Hut approximation for O(n log n) repulsion
//! - Spring forces along edges (attraction toward rest length)
//! - Gravity pulling toward center
//! - Velocity integration with friction damping and linear cooling

use rayon::prelude::*;

// Layout constants
const REPULSION: f64 = 2000.0;
const THETA: f64 = 0.8;
const LINK_SPRING: f64 = 0.5;
const LINK_DISTANCE: f64 = 18.0;
const GRAVITY: f64 = 0.02;
const GRAVITY_ISOLATED: f64 = 0.15;
const FRICTION: f64 = 0.8;
const ITERATIONS: usize = 1500;
const MAX_VELOCITY: f64 = 20.0;
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

    fn insert(&mut self, root: usize, pos: [f64; 2], node_idx: usize) {
        self.insert_inner(root, pos, node_idx, 0);
    }

    fn insert_inner(&mut self, root: usize, pos: [f64; 2], node_idx: usize, depth: usize) {
        if depth >= MAX_TREE_DEPTH {
            // At max depth, just accumulate mass
            let m = self.nodes[root].mass;
            if m == 0.0 {
                self.nodes[root].cx = pos[0];
                self.nodes[root].cy = pos[1];
                self.nodes[root].mass = 1.0;
            } else {
                self.nodes[root].cx = (self.nodes[root].cx * m + pos[0]) / (m + 1.0);
                self.nodes[root].cy = (self.nodes[root].cy * m + pos[1]) / (m + 1.0);
                self.nodes[root].mass = m + 1.0;
            }
            return;
        }

        let [min_x, min_y, max_x, max_y] = self.nodes[root].bounds;

        // If empty leaf, place here
        if self.nodes[root].mass == 0.0 {
            self.nodes[root].cx = pos[0];
            self.nodes[root].cy = pos[1];
            self.nodes[root].mass = 1.0;
            self.nodes[root].node_index = Some(node_idx);
            return;
        }

        // If leaf with existing node, subdivide
        if let Some(_existing_idx) = self.nodes[root].node_index {
            let existing_pos = [self.nodes[root].cx, self.nodes[root].cy];
            self.nodes[root].node_index = None;
            self.insert_into_quadrant(root, existing_pos, _existing_idx, depth);
        }

        // Update center of mass
        let m = self.nodes[root].mass;
        self.nodes[root].cx = (self.nodes[root].cx * m + pos[0]) / (m + 1.0);
        self.nodes[root].cy = (self.nodes[root].cy * m + pos[1]) / (m + 1.0);
        self.nodes[root].mass = m + 1.0;

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
        self.insert_inner(child, pos, node_idx, depth + 1);
    }

    fn insert_into_quadrant(
        &mut self,
        root: usize,
        pos: [f64; 2],
        node_idx: usize,
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
        self.insert_inner(child, pos, node_idx, depth + 1);
    }

    /// Compute repulsive force on a node from the tree.
    fn compute_repulsion(&self, root: usize, px: f64, py: f64, force: &mut [f64; 2]) {
        let node = &self.nodes[root];
        if node.mass == 0.0 {
            return;
        }

        let dx = px - node.cx;
        let dy = py - node.cy;
        let dist_sq = dx * dx + dy * dy;

        // If this is a leaf with a single node, or if sufficiently far away
        let [min_x, _, max_x, _] = node.bounds;
        let size = max_x - min_x;

        let is_leaf = node.children.iter().all(|c| c.is_none());
        let is_far = size * size < THETA * THETA * dist_sq;

        if (is_leaf || is_far) && dist_sq > 1e-6 {
            let dist = dist_sq.sqrt().max(1.0);
            let f = REPULSION * node.mass / (dist * dist);
            force[0] += dx / dist * f;
            force[1] += dy / dist * f;
        } else if !is_leaf {
            // Recurse into children
            for child in &node.children {
                if let Some(child_idx) = child {
                    self.compute_repulsion(*child_idx, px, py, force);
                }
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

    // Compute node degrees for gravity scaling
    let mut degrees = vec![0u32; num_nodes];
    for &(src, tgt) in adjacency {
        degrees[src] += 1;
        degrees[tgt] += 1;
    }

    // Deterministic initial positions: golden-angle spiral
    let golden_angle = std::f64::consts::PI * (3.0 - 5.0_f64.sqrt());
    let mut positions: Vec<[f64; 2]> = (0..num_nodes)
        .map(|i| {
            let r = (i as f64).sqrt() * 10.0;
            let theta = i as f64 * golden_angle;
            [r * theta.cos(), r * theta.sin()]
        })
        .collect();

    let mut velocities = vec![[0.0_f64; 2]; num_nodes];

    for iter in 0..ITERATIONS {
        let temperature = 1.0 - (iter as f64 / ITERATIONS as f64) * 0.99;

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
        for (i, pos) in positions.iter().enumerate() {
            tree.insert(root, *pos, i);
        }

        // Compute repulsive forces (parallel)
        let repulsive_forces: Vec<[f64; 2]> = (0..num_nodes)
            .into_par_iter()
            .map(|i| {
                let mut force = [0.0, 0.0];
                tree.compute_repulsion(root, positions[i][0], positions[i][1], &mut force);
                force
            })
            .collect();

        // Compute spring forces along edges (sequential accumulation)
        let mut spring_forces = vec![[0.0_f64; 2]; num_nodes];
        for &(src, tgt) in adjacency {
            let dx = positions[tgt][0] - positions[src][0];
            let dy = positions[tgt][1] - positions[src][1];
            let dist = (dx * dx + dy * dy).sqrt().max(0.1);
            let displacement = dist - LINK_DISTANCE;
            let f = LINK_SPRING * displacement;
            let fx = dx / dist * f;
            let fy = dy / dist * f;
            spring_forces[src][0] += fx;
            spring_forces[src][1] += fy;
            spring_forces[tgt][0] -= fx;
            spring_forces[tgt][1] -= fy;
        }

        // Integrate forces
        let max_vel = MAX_VELOCITY * temperature;
        for i in 0..num_nodes {
            // Stronger gravity for isolated/low-degree nodes
            let gravity = if degrees[i] == 0 {
                GRAVITY_ISOLATED
            } else {
                GRAVITY
            };
            let gx = -positions[i][0] * gravity;
            let gy = -positions[i][1] * gravity;

            let fx = (repulsive_forces[i][0] + spring_forces[i][0] + gx) * temperature;
            let fy = (repulsive_forces[i][1] + spring_forces[i][1] + gy) * temperature;

            velocities[i][0] = clamp_abs((velocities[i][0] + fx) * FRICTION, max_vel);
            velocities[i][1] = clamp_abs((velocities[i][1] + fy) * FRICTION, max_vel);

            positions[i][0] += velocities[i][0];
            positions[i][1] += velocities[i][1];
        }

        if iter % 100 == 0 {
            println!("  layout iteration {iter}/{ITERATIONS} (temperature: {temperature:.3})");
        }
    }

    positions
}
