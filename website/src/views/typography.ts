/**
 * The names of the type scale's steps, for components.
 *
 * The sizes themselves live in `tokens.css` (`--fs-*` / `--lh-*`), which
 * Tailwind turns into `text-display` … `text-label`. Each step carries its own
 * leading, so a role is one class rather than a size plus a line-height every
 * component has to remember.
 *
 * Nothing in a component may name a size directly; it names one of these
 * roles, and this file is the only place a role maps to a utility.
 *
 * Outside the scale, by design:
 *  - rendered Wikipedia content keeps its own native <small> markup;
 *  - graph node labels are sized in world units by the canvas renderer
 *    (`LABEL_FONT_SIZE_BASE` in graphConstants), because they scale with zoom.
 *
 * Icons may borrow a step (`display` for the audio player's glyph) — they are
 * sized to sit beside text, not to be read as it.
 */
export const textStyles = {
  /** The wordmark on the loading and error plates; at most one per screen. */
  display: "text-display",
  /** A panel's section title. */
  heading: "text-heading",
  /** Prose, collapsible titles, and control values. */
  body: "text-body",
  /** Tabs, control labels, and metadata. */
  small: "text-small",
  /** Micro-labels drawn over the graph. */
  label: "text-label",
} as const;

/** Type definitions for better TypeScript support */
export type TextStyleKey = keyof typeof textStyles;
