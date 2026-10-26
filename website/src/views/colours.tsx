/**
 * Centralized colour styles for the application.
 *
 * All colour classes are defined here so the entire UI can be reskinned
 * from this single file. The palette itself lives in `tailwind.css` (`:root`
 * and the token block below it); this file only names the roles.
 *
 * This file contains ONLY colour-related Tailwind classes. Font sizes live
 * in the parallel typography.ts (the textStyles tokens); other structural
 * concerns (font-weight, border-width, etc.) belong at the callsite.
 *
 * The chrome is monochrome: violet-black surfaces, near-white ink, and one
 * purple accent. Genre hues are data — they arrive per node as
 * `--node-color` and never appear in this sheet.
 */

// ---------------------------------------------------------------------------
// Base colour tokens — the building blocks for all component styles
// ---------------------------------------------------------------------------

const textPrimary = "text-ink";
const textSecondary = "text-ink-muted";
const textOnAccent = "text-white";
// The accent: every active state, focus ring and link in the chrome
const textAccent = "text-accent";

// Backgrounds — surface tiers
const bgApp = "bg-graph";
const bgShell = "plate-shell";
const bgCard = "plate-shell";
// The bordered surface. `bgCard` alone is for surfaces nested inside a panel;
// anything that reads as a card on its own wants this.
const bgPanel = "panel";
const bgElevated = "plate-raised";
const bgInteractive = "bg-panel-hover/70";
const bgInput = "bg-field/80";
const bgAccent = "bg-accent-solid";

// Hovers
const hoverSubtle = "hover:bg-panel-hover/60";
const hoverMedium = "hover:bg-panel-hover/80";

// Borders — hairline rules, never a coloured outline except on the accent
const borderLight = "border-line-strong";
const borderDivider = "border-line";

// ---------------------------------------------------------------------------
// Component styles — organised by component / feature area
// ---------------------------------------------------------------------------

/** All component colour styles, composed from the base tokens above. */
export const colourStyles = {
  // -- Common reusable tokens -----------------------------------------------

  text: {
    primary: textPrimary,
    secondary: textSecondary,
    onAccent: textOnAccent,
    accent: textAccent,
    accentBright: "text-[var(--accent-bright)]",
    link: "text-accent hover:text-[var(--accent-bright)]",
    linkHover: "text-[var(--accent-bright)]",
    accentLink: "text-accent hover:text-[var(--accent-bright)]",
    toggle: "text-ink-muted hover:text-ink",
    meta: textSecondary,
    metaInline: "text-ink-faint",
  },

  bg: {
    app: bgApp,
    shell: bgShell,
    card: bgCard,
    panel: bgPanel,
    elevated: bgElevated,
    interactive: bgInteractive,
    input: bgInput,
    accent: bgAccent,
    handle: "bg-line-strong",
    black: "bg-black",
  },

  hover: {
    subtle: hoverSubtle,
    medium: hoverMedium,
    accent: "hover:bg-[var(--accent-solid-hover)]",
  },

  border: {
    light: borderLight,
    divider: borderDivider,
    selectedRing: "ring-accent",
    audioSection: "border-line-strong",
    audioContainer: "border-line",
    abbr: "border-ink-faint",
  },

  // Shared button colour pattern: the active state is a solid box with white
  // text, the inactive state is bare until hovered.
  button: {
    active: `${bgAccent} border-accent-solid ${textOnAccent}`,
    inactive: `bg-transparent border-transparent ${hoverSubtle} ${textSecondary} hover:text-ink`,
  },

  // -- Component-specific compositions --------------------------------------

  // Truncation toggles, inline and full width. The fill is opaque and carries
  // a hairline: over a genre tile, a translucent fill takes the tile's hue and
  // leaves the button with no edge to read as a control.
  toggle: `bg-band-sub border border-line-strong ${textPrimary} hover:bg-[var(--band-sub-hover)] transition-colors cursor-pointer`,

  // Loading state
  loading: {
    spinner: "border-line-strong border-t-accent",
  },

  // Sidebar — no background on the shell so empty space shows the graph
  // through; individual sections provide their own panels via bg.card.
  sidebar: {
    background: "",
    mobileBackground: "",
    itemInactive: `${bgCard} ${hoverSubtle} ${textPrimary}`,
  },

  // Graph node
  node: {
    background: "bg-[var(--node-color)]",
    hover: "hover:brightness-125",
  },

  // Project information
  project: {
    title: `bg-[var(--node-color)] hover:bg-[var(--node-color-hovered-color)] ${textOnAccent}`,
    subtitle: `bg-[var(--node-color)] ${textOnAccent}`,
    control: `bg-[var(--node-color)] hover:bg-[var(--node-color-hovered-color)] ${textOnAccent} transition-colors`,
  },

  // Search
  search: {
    button: `${bgInteractive} ${hoverMedium} ${textPrimary}`,
    input: `${bgInput} ${textPrimary} placeholder:text-ink-faint`,
    item: `${bgCard} ${hoverSubtle} ${textPrimary}`,
  },

  // Audio / Listen components
  audio: {
    playerText: textPrimary,
    playerTextMuted: textSecondary,
    playerTitle: textPrimary,
  },

  // Tooltip
  tooltip: {
    background: `plate-floating ${textPrimary}`,
  },

  // Section heading — the display face on its own band, over a rule
  section: {
    heading: "bg-band border-b border-line-strong",
  },

  // Notice / alert (bg + text combined)
  notice: {
    yellow: "bg-warn-wash border border-warn/40 text-warn",
    red: "bg-danger-wash border border-danger/40 text-danger",
    blue: "bg-info-wash border border-info/40 text-info",
    green: "border border-good/40 text-good",
  },

  // Input / control
  input: {
    primary: `${bgAccent} hover:bg-[var(--accent-solid-hover)] text-white`,
    label: `${bgInteractive} ${textPrimary}`,
  },

  // Footnote
  footnote: {
    background: `${bgElevated} ${textPrimary}`,
  },

  // Collapsible — a sub-band: darker than a section title, so nesting reads
  collapsible: {
    header: `bg-band-sub hover:bg-[var(--band-sub-hover)] ${textPrimary} transition-colors`,
    content: `reading border-t ${borderDivider}`,
  },

  // Blockquote
  blockquote: {
    border: "border-accent-solid",
    text: "text-ink-muted",
  },

  // YouTube embed
  youtube: {
    background: "bg-black",
    loadingText: "text-ink-faint",
    spinner: "border-line-strong border-t-accent",
  },

  // Genre link
  genreLink: {
    text: "text-[var(--node-color)] hover:text-[var(--node-color-hover)]",
  },
} as const;

/** Type definitions for better TypeScript support */
export type ColourStyleKey = keyof typeof colourStyles;
