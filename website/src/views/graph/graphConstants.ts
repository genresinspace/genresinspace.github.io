/**
 * Visual constants for the graph renderer.
 * Collected here so they're easy to find and tweak.
 */

// ── Edges ────────────────────────────────────────────────────────────
/** Number of quad segments per curved edge (more = smoother curve). */
export const EDGE_SEGMENTS = 8;
/** Bezier curvature factor (0 = straight, higher = more arc). */
export const EDGE_CURVATURE = 0.15;
/** Edge half-width in world units. */
export const EDGE_WIDTH = 0.48;
/** Edge color saturation (HSL) when selected or in path. */
export const EDGE_SELECTED_SATURATION = 90;
/** Edge color saturation (HSL) when nothing is selected. */
export const EDGE_UNSELECTED_SATURATION = 70;
/** Edge alpha when connected to the selected node. */
export const EDGE_SELECTED_ALPHA = 0.4;
/** Edge alpha when not connected to the selected node. */
export const EDGE_UNSELECTED_ALPHA = 0.15;
/** Exponential base for edge opacity falloff with distance (0–1). */
export const EDGE_OPACITY_FALLOFF = 0.25;

// ── Edge endpoint tinting (fragment shader) ──────────────────────────
/** Smoothstep range for source node color bleed into edge (start, end). */
export const EDGE_SRC_TINT_RANGE: [number, number] = [0.45, 0.0];
/** Smoothstep range for target node color bleed into edge (start, end). */
export const EDGE_TGT_TINT_RANGE: [number, number] = [0.55, 1.0];
/** Power curve for endpoint tinting blend. */
export const EDGE_TINT_POWER = 0.4;

// ── Nodes ────────────────────────────────────────────────────────────
/** Base world-unit diameter for nodes. */
export const NODE_SIZE_BASE = 60.0;
/** Minimum fraction of base size (for 0-degree nodes). */
export const NODE_SIZE_MIN_FRAC = 0.2;
/** Fraction of base size contributed by edge degree. */
export const NODE_SIZE_DEGREE_FRAC = 0.8;
/** World units to shrink non-highlighted nodes when a selection is active. */
export const NODE_SHRINK_UNSELECTED = 1.5;
/** World units to grow the focused node. */
export const NODE_GROW_FOCUSED = 1.5;
/** World units to grow the hovered node. */
export const NODE_GROW_HOVERED = 2.5;
// ── Node colors ──────────────────────────────────────────────────────
/** RGB multiplier for non-highlighted nodes when a selection is active. */
export const NODE_DIM_RGB = 0.3;
/** Alpha for non-highlighted nodes when a selection is active. */
export const NODE_DIM_ALPHA = 0.06;
/** Exponential base for node opacity falloff with distance (0–1). */
export const NODE_OPACITY_FALLOFF = 0.25;
/** HSL lightness for graph nodes on a light-mode background. */
export const NODE_LIGHTNESS_LIGHT = 72;
/** HSL lightness for graph nodes on a dark-mode background. */
export const NODE_LIGHTNESS_DARK = 60;

// ── Arrows ───────────────────────────────────────────────────────────
/** World-unit spacing between arrows on animated edges. */
export const ARROW_SPACING = 60;
/** Arrow animation speed in world units per second. */
export const ARROW_WORLD_SPEED = 30.0;
/** Source-end margin as a multiple of arrow size. */
export const ARROW_MARGIN_SRC = 0;
/** Target-end margin: fraction of target node radius. */
export const ARROW_MARGIN_TGT_RADIUS = 0.3;
/** Arrow width as a fraction of arrow length. */
export const ARROW_WIDTH_RATIO = 0.3;
/** Multiplier applied to the arrowSizeScale setting. */
export const ARROW_SIZE_MULTIPLIER = 12;
/** Exponential base for arrow speed falloff with distance (0–1). */
export const ARROW_SPEED_FALLOFF = 0.5;

// ── Cursor proximity ────────────────────────────────────────────────
/** Radius (world units) within which nodes are subtly highlighted near cursor. */
export const CURSOR_PROXIMITY_RADIUS = 120;

// ── Transitions & interaction ────────────────────────────────────────
/** Exponential decay time constant for hover transitions (ms). */
export const TRANSITION_TAU = 120;
/** Debounce delay for hover events (ms). */
export const HOVER_DEBOUNCE_MS = 80;

// ── Background ───────────────────────────────────────────────────────
/** Graph background color for light mode (RGBA 0–1). */
export const BG_LIGHT: [number, number, number, number] = [0.12, 0.12, 0.14, 1];
/** Graph background color for dark mode (RGBA 0–1). */
export const BG_DARK: [number, number, number, number] = [0, 0, 0, 1];

// ── Zoom-to-fit ──────────────────────────────────────────────────────
/** Fit neighbourhood to this many standard deviations. */
export const FIT_STDDEV_MULT = 2;
/** Minimum world-unit radius when zooming to a selected neighbourhood. */
export const FIT_RADIUS_MIN = 250;
/** Padding around the neighbourhood when auto-fitting (fraction of smaller viewport axis). */
export const FIT_PADDING_FRAC = 0.1;
/** Duration (ms) of the zoom-to-neighbourhood animation. */
export const FIT_ANIM_DURATION = 1200;

// ── Labels ───────────────────────────────────────────────────────────
/** Maximum number of labels displayed simultaneously (at reference resolution). */
export const MAX_VISIBLE_LABELS = 100;
/** Reference screen area (px²) at which MAX_VISIBLE_LABELS applies. */
export const LABEL_REFERENCE_AREA = 1920 * 1080;
/** Minimum label count regardless of screen size. */
export const LABEL_COUNT_MIN = 15;
/** Maximum label count regardless of screen size. */
export const LABEL_COUNT_MAX = 200;
/** Zoom level where labels start scaling (fixed size until reached). */
export const LABEL_ZOOM_THRESHOLD = 1.5;
/** Fraction of full zoom-scaling applied to labels beyond the threshold. */
export const LABEL_ZOOM_RATE = 0.5;
/** Estimated character width as a fraction of font size (for overlap culling). */
export const LABEL_CHAR_WIDTH_RATIO = 0.65;
/** Horizontal padding inside each label (px, both sides combined). */
export const LABEL_PADDING_H = 16;
/** Vertical padding + border height inside each label (px). */
export const LABEL_PADDING_V = 8;
/** Inter-label gap added to bounding boxes for overlap culling (px). */
export const LABEL_GAP = 4;
/** Extra HSL lightness added to labels for the dark graph background. */
export const LABEL_LIGHTNESS_BOOST = 5;
/** Screen-pixel grid columns for spatial label bucketing. */
export const LABEL_GRID_COLS = 8;
/** Screen-pixel grid rows for spatial label bucketing. */
export const LABEL_GRID_ROWS = 6;
/** Base font size for labels (px). */
export const LABEL_FONT_SIZE_BASE = 10;
/** Max font size contribution from edge degree (px). */
export const LABEL_FONT_SIZE_DEGREE = 6;
/** Label opacity falloff base per distance step. */
export const LABEL_OPACITY_FALLOFF = 0.25;
/** HSL lightness boost added to each label colour when hovered. */
export const LABEL_HOVER_LIGHTNESS_BOOST = 5;
/** HSL lightness boost added to each label colour when selected. */
export const LABEL_SELECTED_LIGHTNESS_BOOST = 20;
/** CSS brightness for labels outside the selected net. */
export const LABEL_DIM_BRIGHTNESS = 0.4;
/** Opacity for labels outside the selected net. */
export const LABEL_DIM_OPACITY = 0.2;
