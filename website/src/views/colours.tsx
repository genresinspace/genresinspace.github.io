/**
 * Centralized colour styles for the application.
 *
 * All colour classes are defined here so the entire UI can be reskinned
 * from this single file. Base colour tokens at the top cascade into the
 * component styles below — change a token to update every style that uses it.
 *
 * This file contains ONLY colour-related Tailwind classes. Structural
 * concerns (font-weight, font-size, border-width, shadow, etc.) belong
 * at the callsite.
 *
 * Star-atlas dark design: deep-space navy instrument plates (defined as
 * @utility classes in tailwind.css) with brass hairlines and a pale-cyan
 * secondary accent. The app is dark-only — no light-mode tokens.
 */

// ---------------------------------------------------------------------------
// Base colour tokens — the building blocks for all component styles
// ---------------------------------------------------------------------------

// Text — warm starlight primary, cool slate secondary. Secondary tones are
// kept bright enough to clear ~6:1 contrast on the navy plates even at the
// small sizes they're used for.
const textPrimary = "text-[#e9e3d3]";
const textSecondary = "text-[#a6b2c9]";
const textOnAccent = "text-[#f4eedd]";
// Brass: the primary instrument accent
const textBrass = "text-[#d9c08a]";
// Brighter brass for active/selected emphasis (tabs, highlighted controls)
const textBrassBright = "text-[#ecd9ae]";

// Backgrounds — instrument plate tiers
const bgApp = "bg-[#04060f]";
const bgShell = "plate-shell";
const bgCard = "plate-shell";
const bgElevated = "plate-raised";
const bgInteractive = "bg-[#1a2440]/70";
const bgInput = "bg-[#060a18]/80";
const bgAccent = "bg-[#a8854a]";
const bgHandle = "bg-[#c9a86a]/50";

// Hovers
const hoverSubtle = "hover:bg-[#1c2845]/60";
const hoverMedium = "hover:bg-[#243155]/80";
const hoverAccent = "hover:bg-[#bd9a5e]";

// Borders — brass hairlines and faint navy dividers
const borderLight = "border-[#c9a86a]/30";
const borderDivider = "border-[#27334f]/80";

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
    brass: textBrass,
    link: "text-[#8fd0e0]",
    linkHover: "text-[#8fd0e0] hover:text-[#b8e4ef]",
    accentLink: "text-[#d9c08a]",
    toggle: "text-[#a6b2c9] hover:text-[#e9e3d3]",
    meta: "text-[#9ba6bc]",
    metaInline: "text-[#8893aa]",
  },

  bg: {
    app: bgApp,
    shell: bgShell,
    card: bgCard,
    elevated: bgElevated,
    interactive: bgInteractive,
    input: bgInput,
    accent: bgAccent,
    handle: bgHandle,
    black: "bg-black",
  },

  hover: {
    subtle: hoverSubtle,
    medium: hoverMedium,
    accent: hoverAccent,
  },

  border: {
    light: borderLight,
    divider: borderDivider,
    selectedRing: "ring-[#c9a86a]",
    audioSection: "border-[#3a486b]",
    audioContainer: "border-[#1d2742]",
    abbr: "border-[#8893aa]",
  },

  // Shared button colour pattern (callsite adds font-bold etc.)
  button: {
    active: `bg-[#c9a86a]/25 border-[#e3cc97] ${textBrassBright}`,
    inactive: `bg-transparent border-transparent ${hoverSubtle} ${textSecondary} hover:text-[#e9e3d3]`,
  },

  // -- Component-specific compositions --------------------------------------

  // Loading state
  loading: {
    spinner: "border-[#c9a86a]/30 border-t-[#c9a86a]",
  },

  // Sidebar — no background on the shell so empty space shows the graph
  // through; individual sections provide their own plates via bg.card.
  sidebar: {
    background: "",
    mobileBackground: "",
    itemInactive: `${bgCard} ${hoverSubtle} ${textPrimary}`,
  },

  // Graph node
  node: {
    background: "bg-[var(--node-color)]",
    hover: "hover:filter hover:brightness-[1.6]",
  },

  // Project information
  project: {
    title: `bg-[var(--node-color)] hover:bg-[var(--node-hovered-color)] ${textOnAccent}`,
    subtitle: `bg-[var(--node-color)] ${textOnAccent}`,
  },

  // Search
  search: {
    button: `${bgInteractive} ${hoverMedium} ${textPrimary}`,
    input: `${bgInput} ${textPrimary} placeholder:text-[#8893aa]`,
    item: `${bgCard} ${hoverSubtle} ${textPrimary}`,
  },

  // Audio / Listen components
  audio: {
    playerText: "text-[#d4dae6]",
    playerTextMuted: "text-[#aeb8ca]",
    playerTitle: "text-[#e9e3d3]",
  },

  // Tooltip
  tooltip: {
    background: `plate-floating ${textPrimary}`,
  },

  // Section heading — a cartouche strip on each instrument plate
  section: {
    heading: `bg-[#101a30]/90 border-b border-[#c9a86a]/25 ${textBrass}`,
  },

  // Notice / alert (bg + text combined)
  notice: {
    yellow: "bg-[#c9a86a]/12 border border-[#c9a86a]/45 text-[#ecd9ae]",
    red: "bg-[#a64242]/15 border border-[#c46a6a]/45 text-[#eec9c2]",
    blue: "bg-[#4a90a8]/12 border border-[#6fb4c8]/40 text-[#cfe8ef]",
    green: "bg-[#4a9a78]/12 border border-[#6dbb98]/40 text-[#cfeadd]",
  },

  // Input / control
  input: {
    primary: `${bgAccent} ${hoverAccent} text-[#0a0f1e]`,
    label: `${bgInteractive} ${textPrimary}`,
  },

  // Footnote
  footnote: {
    background: `${bgElevated} ${textPrimary}`,
  },

  // Collapsible
  collapsible: {
    background: `bg-[#101a30]/70 hover:bg-[#1a2745]/80 ${textPrimary}`,
  },

  // Blockquote
  blockquote: {
    border: "border-[#c9a86a]/40",
    text: "text-[#c3cad8]",
  },

  // YouTube embed
  youtube: {
    background: "bg-black",
    loadingText: "text-[#8893aa]",
    spinner: "border-[#2a3a5c] border-t-[#c9a86a]",
  },

  // Genre link
  genreLink: {
    text: "text-[var(--node-color)] hover:text-[var(--node-color-hover)]",
  },
} as const;

/** Type definitions for better TypeScript support */
export type ColourStyleKey = keyof typeof colourStyles;
