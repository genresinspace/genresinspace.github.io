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
 * Glassmorphic dark design: layers translucent panels over the graph using
 * three tiers (shell, panel, floating) defined as @utility classes in
 * tailwind.css. Dark mode is enforced; light-mode tokens are not separately
 * art-directed.
 */

// ---------------------------------------------------------------------------
// Base colour tokens — the building blocks for all component styles
// ---------------------------------------------------------------------------

// Text
const textPrimary = "text-white";
const textSecondary = "text-slate-400";
const textOnAccent = "text-white";

// Backgrounds — glass tiers
const bgApp = "bg-slate-950";
const bgShell = "glass-shell";
const bgCard = "glass-panel";
const bgElevated = "glass-panel";
const bgInteractive = "bg-white/10";
const bgInput = "bg-black/30";
const bgAccent = "bg-purple-600";
const bgHandle = "bg-white/30";

// Hovers
const hoverSubtle = "hover:bg-white/10";
const hoverMedium = "hover:bg-white/15";
const hoverAccent = "hover:bg-purple-700";

// Borders
const borderLight = "border-white/10";
const borderDivider = "border-white/5";

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
    link: "text-blue-400",
    linkHover: "text-blue-400 hover:text-blue-300",
    accentLink: "text-purple-600 dark:text-purple-400",
    toggle: "text-neutral-400 hover:text-white",
    meta: "text-gray-500 dark:text-gray-400",
    metaInline: "text-gray-500",
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
    selectedRing: "ring-blue-500",
    audioSection: "border-neutral-600",
    audioContainer: "border-neutral-800",
    abbr: "border-gray-500",
  },

  // Shared button colour patterns (callsite adds font-bold etc.)
  button: {
    active: `bg-purple-500/30 ${textOnAccent}`,
    inactive: `${bgInteractive} ${hoverMedium} ${textPrimary}`,
  },

  // -- Component-specific compositions --------------------------------------

  // Loading state
  loading: {
    spinner: "border-white/20 border-t-purple-400",
  },

  // Sidebar
  sidebar: {
    background: bgShell,
    mobileBackground: bgShell,
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
    input: `${bgInput} ${textPrimary} placeholder:text-slate-400`,
    item: `${bgCard} ${hoverSubtle} ${textPrimary}`,
  },

  // Audio / Listen components
  audio: {
    playerText: "text-gray-200",
    playerTextMuted: "text-gray-300",
    playerTitle: "text-gray-100",
  },

  // Tooltip
  tooltip: {
    background: `glass-floating ${textPrimary}`,
  },

  // Section heading
  section: {
    heading: `bg-white/5 ${textOnAccent}`,
  },

  // Notice / alert (bg + text combined)
  notice: {
    yellow:
      "bg-yellow-500/10 backdrop-blur-md border border-yellow-500/30 text-yellow-100",
    red: "bg-red-500/10 backdrop-blur-md border border-red-500/30 text-red-100",
    blue: "bg-blue-500/10 backdrop-blur-md border border-blue-500/30 text-blue-100",
    green:
      "bg-green-500/10 backdrop-blur-md border border-green-500/30 text-green-100",
  },

  // Input / control
  input: {
    primary: `${bgAccent} ${hoverAccent} ${textOnAccent}`,
    label: `${bgInteractive} ${textPrimary}`,
  },

  // Footnote
  footnote: {
    background: `${bgElevated} ${textPrimary}`,
  },

  // Collapsible
  collapsible: {
    background: `bg-black/30 hover:bg-black/40 ${textPrimary}`,
  },

  // Blockquote
  blockquote: {
    border: "border-gray-300 dark:border-gray-700",
    text: "text-gray-700 dark:text-gray-300",
  },

  // YouTube embed
  youtube: {
    background: "bg-black",
    loadingText: "text-slate-500",
    spinner: "border-slate-600 border-t-slate-400",
  },

  // Genre link
  genreLink: {
    text: "text-[var(--node-color)] hover:text-[var(--node-color-hover)]",
  },

  // Asset icon page (assets/icon.html — uses gray/blue instead of slate/purple)
  icon: {
    body: "bg-slate-100 dark:bg-black",
    sidebar: "bg-slate-200 dark:bg-gray-900 text-slate-900 dark:text-white",
    input: "bg-slate-300 dark:bg-gray-800 text-slate-900 dark:text-white",
    button:
      "bg-slate-300 dark:bg-gray-700 hover:bg-slate-400 dark:hover:bg-gray-600 text-slate-900 dark:text-white",
    buttonPrimary:
      "bg-purple-600 dark:bg-blue-700 hover:bg-purple-700 dark:hover:bg-blue-600 text-white",
    buttonDisabled:
      "bg-slate-400 dark:bg-gray-800 text-slate-500 dark:text-gray-500",
    buttonActive:
      "bg-purple-700 dark:bg-blue-600 hover:bg-purple-800 dark:hover:bg-blue-700 text-white",
    listContainer:
      "bg-slate-200 dark:bg-gray-950 text-slate-900 dark:text-white",
    listItem:
      "hover:bg-slate-300 dark:hover:bg-gray-800 text-slate-900 dark:text-white",
    listItemActive:
      "bg-purple-100 dark:bg-blue-900 text-slate-900 dark:text-white",
    content: "bg-slate-200 dark:bg-gray-800 text-slate-900 dark:text-white",
  },
} as const;

/** Type definitions for better TypeScript support */
export type ColourStyleKey = keyof typeof colourStyles;
