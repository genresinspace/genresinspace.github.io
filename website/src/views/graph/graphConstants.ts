/**
 * Visual constants for the graph renderer.
 * Collected here so they're easy to find and tweak.
 */

import { oklchCss, oklchToRgb, readColourToken } from "../../util/colour";

// ── Edges ────────────────────────────────────────────────────────────
/** Number of quad segments per curved edge (more = smoother curve). */
export const EDGE_SEGMENTS = 8;
/** Bezier curvature factor (0 = straight, higher = more arc). */
export const EDGE_CURVATURE = 0.15;
/** Edge half-width at zoom = 1 (world units when EDGE_ARROW_SCREEN_SPACE = 0). */
export const EDGE_WIDTH = 0.48;
/** How much edges and arrows compensate for camera zoom.
 *  0 = pure world-space: geometry is a fixed world size, so screen size scales linearly with zoom.
 *  1 = pure camera-space: geometry is a fixed screen size, so world size shrinks as you zoom in.
 *  Values in between blend the two — at k the screen size scales like zoom^(1-k). */
export const EDGE_ARROW_SCREEN_SPACE = 0.8;
/** Edge colour saturation (as a percentage of the edge hue's full chroma) when
 *  selected or in the path. */
export const EDGE_SELECTED_SATURATION = 90;
/** Edge colour saturation (as a percentage of the edge hue's full chroma) when
 *  nothing is selected. Kept below the selected value so hue reads as a tint
 *  under the graph rather than as fog. */
export const EDGE_UNSELECTED_SATURATION = 45;
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
/** Base world-unit diameter for nodes. Larger than the old solid-disc
 *  renderer because the star shader's bright core occupies only the inner
 *  portion of the sprite; the rest is glow falloff. */
export const NODE_SIZE_BASE = 84.0;
/** Minimum fraction of base size (for 0-degree nodes). */
export const NODE_SIZE_MIN_FRAC = 0.2;
/** Fraction of base size contributed by edge degree. */
export const NODE_SIZE_DEGREE_FRAC = 0.8;
/** World units to shrink non-highlighted nodes when a selection is active. */
export const NODE_SHRINK_UNSELECTED = 1.5;
/** World units to grow the selected node, so its astrolabe reticle reads
 *  clearly even at neighbourhood zoom. */
export const NODE_GROW_SELECTED = 16.0;
/** World units to grow the hovered node. A flat delta does not survive the
 *  range of node sizes — 2.5 units is 15% of a leaf and 3% of a hub — and the
 *  star sprite's bright core is only its inner portion, so growth is a fraction
 *  of the node's own size. */
export const NODE_GROW_HOVERED_FRAC = 0.25;
// ── Node colors ──────────────────────────────────────────────────────
/** RGB multiplier for non-highlighted nodes when a selection is active. */
export const NODE_DIM_RGB = 0.3;
/** Alpha for non-highlighted nodes when a selection is active. */
export const NODE_DIM_ALPHA = 0.06;
/** Exponential base for node opacity falloff with distance (0–1). */
export const NODE_OPACITY_FALLOFF = 0.25;
/** How far a node on a route is pushed toward white. A route is brightened
 *  rather than isolated: the neighbourhood stays readable, and the connection
 *  reads as the brightest thing running through it. Serves both routes, the
 *  searched one and the one a hover reveals. */
export const NODE_PATH_BRIGHTEN = 0.5;
/** Saturation for a route's edges. */
export const EDGE_PATH_SATURATION = 100;
/** Alpha for a route's edges, against 0.4 for the rest of a selected
 *  neighbourhood. */
export const EDGE_PATH_ALPHA = 1;
/** How far the route's edge colour is pushed toward white. Edges are coloured
 *  by relation type, so a route edge shares its hue with every other edge of
 *  that type; alpha alone is not enough to pick it out. */
export const EDGE_PATH_BRIGHTEN = 0.45;
/** Width multiplier for the route's edges. The strongest cue on a dark canvas:
 *  a wider line reads at a glance where a slightly brighter one does not. */
export const EDGE_PATH_WIDTH_MULT = 2.6;
/** HSL lightness for graph nodes — lifted slightly above the canvas so the
 *  glow reads. */
export const NODE_LIGHTNESS = 66;

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
/** Delay before a focused node is allowed to move the camera, so a pointer
 *  crossing a list of links does not fire a pan per row. */
export const FOCUS_PAN_DELAY_MS = 120;
/** Duration of a pan to a focused node that lies outside the viewport. Short
 *  enough to read as a nudge rather than the deliberate fit-to-content move. */
export const FOCUS_PAN_DURATION = 320;

// ── Background ───────────────────────────────────────────────────────
/** Cached so the renderer's per-frame request does not re-read the cascade. */
let cachedBackground: [number, number, number, number] | null = null;

/** The graph's background colour, read from the `--graph` token. */
export function graphBackground(): [number, number, number, number] {
  // Black if the stylesheet has not applied; the page is unstyled in that case
  // anyway, and a neutral fallback keeps this file free of palette values.
  cachedBackground ??= [...readColourToken("--graph", { l: 0, c: 0, h: 0 }), 1];
  return cachedBackground;
}
/** Reticle colour for the selected star (RGB 0–1): ink, so it reads against
 *  every genre hue instead of competing with them. */
export const RETICLE_COLOR: [number, number, number] = oklchToRgb(
  0.96,
  0.006,
  300
);

// ── No-path connector ────────────────────────────────────────────────
/** Muted stroke for the severed connector drawn between unreachable endpoints. */
export const NO_PATH_LINE_COLOR = oklchCss(0.72, 0.014, 300);
/** Soft red for the break (✕) marking the gap in the severed connector. */
export const NO_PATH_BREAK_COLOR = oklchCss(0.74, 0.082, 5);

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
export const LABEL_LIGHTNESS_BOOST = 7;
/**
 * Minimum centre-to-centre label separation, as a multiple of the
 * even-spread radius `sqrt(viewportArea / labelBudget)`. Spreads labels across
 * the graph instead of clustering in the dense centre; higher = sparser.
 */
export const LABEL_SPACING_FACTOR = 0.8;
/**
 * Pan bucket size (screen px) for the canonical label-reselection signature.
 * Label reselection is gated on a canonical viewport signature so the same
 * camera always yields the same label set, regardless of how it got there; the
 * set is recomputed once the camera pans ~this many pixels. Between buckets the
 * cached set is reused and tracked by the container CSS transform (smooth).
 */
export const LABEL_RESELECT_PAN_PX = 24;
/**
 * Zoom bucket ratio for the canonical label-reselection signature: the set is
 * recomputed once zoom changes by ~this factor. See {@link LABEL_RESELECT_PAN_PX}.
 */
export const LABEL_RESELECT_ZOOM_STEP = 1.08;
/** Base font size for labels (px). */
export const LABEL_FONT_SIZE_BASE = 11;
/** Max font size contribution from edge degree (px). Generous, so the
 *  first-magnitude genres read like the big engraved names on a chart. */
export const LABEL_FONT_SIZE_DEGREE = 9;
/** Label opacity falloff base per distance step. */
export const LABEL_OPACITY_FALLOFF = 0.25;
/** HSL lightness boost added to each label colour when hovered. Large enough
 *  to be the visible answer to a hover: the hovered label is usually already at
 *  full opacity, so a small lift reads as nothing. */
export const LABEL_HOVER_LIGHTNESS_BOOST = 12;
/** HSL lightness boost added to each label colour when selected. */
export const LABEL_SELECTED_LIGHTNESS_BOOST = 20;
/** Font-size multiplier for the selected node's label: the chart's primary
 *  focus should be readable without leaning in, regardless of degree. */
export const LABEL_SELECTED_SIZE_MULT = 1.35;
/** Delay before a label's pointerleave releases the hover, so that a label
 *  shifting under a stationary pointer (zoom, camera inertia) does not drop the
 *  hover the pointer still means. */
export const LABEL_HOVER_RELEASE_MS = 80;
/** CSS brightness for labels outside the selected net. */
export const LABEL_DIM_BRIGHTNESS = 0.5;
/** Opacity for labels outside the selected net. */
export const LABEL_DIM_OPACITY = 0.28;
