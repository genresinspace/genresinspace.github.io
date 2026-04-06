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
 * Modern, harmonious color palette:
 * - Dark mode: Deep slate with purple accents
 * - Light mode: Slate grays with purple accents
 */

// ---------------------------------------------------------------------------
// Base colour tokens — the building blocks for all component styles
// ---------------------------------------------------------------------------

// Text
const textPrimary = "text-slate-900 dark:text-white";
const textSecondary = "text-slate-600 dark:text-slate-400";
const textOnAccent = "text-white";

// Backgrounds
const bgApp = "bg-slate-100 dark:bg-slate-900";
const bgCard = "bg-slate-200 dark:bg-slate-900";
const bgElevated = "bg-slate-200 dark:bg-slate-800";
const bgInteractive = "bg-slate-200 dark:bg-slate-700";
const bgInput = "bg-slate-300 dark:bg-slate-700";
const bgAccent = "bg-purple-600 dark:bg-purple-700";
const bgHandle = "bg-slate-500 dark:bg-slate-600";

// Hovers
const hoverSubtle = "hover:bg-slate-300 dark:hover:bg-slate-800";
const hoverMedium = "hover:bg-slate-400 dark:hover:bg-slate-600";
const hoverAccent = "hover:bg-purple-700 dark:hover:bg-purple-600";

// Borders
const borderLight = "border-slate-400 dark:border-slate-600";
const borderDivider = "border-neutral-700";

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
    active: `${bgAccent} ${textOnAccent}`,
    inactive: `${bgInteractive} ${hoverMedium} ${textPrimary}`,
  },

  // -- Component-specific compositions --------------------------------------

  // Loading state
  loading: {
    spinner:
      "border-slate-400 dark:border-slate-600 border-t-purple-600 dark:border-t-white",
  },

  // Sidebar
  sidebar: {
    background: "bg-transparent",
    mobileBackground: "bg-slate-200 dark:bg-slate-950",
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
    button: `${bgInput} ${hoverMedium} ${textPrimary}`,
    input: `${bgInput} text-slate-950 dark:text-white placeholder:text-slate-600 dark:placeholder:text-slate-400`,
    item: "bg-slate-200 dark:bg-slate-900 hover:bg-slate-500 dark:hover:bg-slate-700 text-slate-900 dark:text-white",
  },

  // Audio / Listen components
  audio: {
    playerText: "text-gray-200",
    playerTextMuted: "text-gray-300",
    playerTitle: "text-gray-100",
  },

  // Tooltip
  tooltip: {
    background: `bg-slate-100 dark:bg-slate-950 ${textPrimary}`,
  },

  // Section heading
  section: {
    heading: `bg-slate-400 dark:bg-slate-800 ${textOnAccent}`,
  },

  // Notice / alert (bg + text combined)
  notice: {
    yellow: "bg-yellow-50 dark:bg-yellow-100/90 text-yellow-900",
    red: "bg-red-50 dark:bg-red-100/90 text-red-900",
    blue: "bg-blue-50 dark:bg-slate-800 text-blue-900 dark:text-slate-100",
    green: "bg-green-50 dark:bg-green-100/90 text-green-900",
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
    background: `bg-slate-300 dark:bg-slate-800/50 hover:bg-slate-400 dark:hover:bg-slate-800 ${textPrimary}`,
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
