/**
 * Centralized colour styles for the application
 *
 * Modern, harmonious color palette
 * - Dark mode: Deep slate with teal accents
 * - Light mode: Clean whites with warm blue-gray and teal accents
 */
export const colourStyles = {
  // Main application backgrounds
  app: {
    background: "bg-white dark:bg-slate-900",
  },

  // Sidebar styles
  sidebar: {
    background: "bg-slate-50 dark:bg-slate-900",
    hover: "hover:bg-slate-100 dark:hover:bg-slate-800",
    resizer: "bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600",
    resizerActive: "bg-slate-400 dark:bg-slate-600",
    itemActive: "bg-teal-600 dark:bg-teal-700 font-bold text-white",
    itemInactive: "bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white",
  },

  // Node styles
  node: {
    background: "bg-[var(--node-color)]",
    hover: "hover:filter hover:brightness-[1.6]",
    infoBackground: "bg-slate-100 dark:bg-slate-800",
    buttonActive: "bg-teal-600 dark:bg-teal-700 font-bold text-white",
    buttonInactive: "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white",
  },

  // Project information styles
  project: {
    button: "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white",
    title: "bg-[var(--node-color)] hover:bg-[var(--node-hovered-color)] text-white",
    subtitle: "bg-[var(--node-color)] text-white",
  },

  // Search styles
  search: {
    container: "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600",
    button: "bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 text-slate-900 dark:text-white",
    input: "bg-slate-300 dark:bg-slate-700 text-slate-950 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400",
    results: "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white shadow-md",
    item: "bg-slate-100 dark:bg-slate-900 hover:bg-slate-400 dark:hover:bg-slate-700 text-slate-900 dark:text-white shadow-md",
  },

  // Wikipedia component styles
  wikitext: {
    button: "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-white",
    inline: "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-white",
  },

  // Audio/Listen component styles
  audio: {
    button: "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white",
    progress: "bg-slate-200 dark:bg-slate-700",
    container: "bg-white dark:bg-slate-900 text-slate-900 dark:text-white",
  },

  // Tooltip styles
  tooltip: {
    background: "bg-white dark:bg-slate-950 text-slate-900 dark:text-white",
  },

  // Section styles
  section: {
    heading: "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white",
  },

  // Notice styles
  notice: {
    yellow: "bg-yellow-50 dark:bg-yellow-100/90 text-yellow-900",
    red: "bg-red-50 dark:bg-red-100/90 text-red-900",
    blue: "bg-blue-50 dark:bg-blue-100/90 text-blue-900",
    green: "bg-green-50 dark:bg-green-100/90 text-green-900",
  },

  // Input styles
  input: {
    primary: "bg-teal-600 dark:bg-teal-700 hover:bg-teal-700 dark:hover:bg-teal-600 text-white",
    label: "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white",
    secondary: "bg-teal-600 dark:bg-teal-700 hover:bg-teal-700 dark:hover:bg-teal-600 text-white",
  },

  // Footnote styles
  footnote: {
    background: "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white",
  },

  // Collapsible styles
  collapsible: {
    background: "bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-900 dark:text-white",
  },

  // Asset icon styles (from assets/icon.html)
  icon: {
    body: "bg-white dark:bg-black",
    sidebar: "bg-slate-100 dark:bg-gray-900 text-slate-900 dark:text-white",
    input: "bg-slate-200 dark:bg-gray-800 text-slate-900 dark:text-white",
    button: "bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 dark:hover:bg-gray-600 text-slate-900 dark:text-white",
    buttonPrimary: "bg-teal-600 dark:bg-blue-700 hover:bg-teal-700 dark:hover:bg-blue-600 text-white",
    buttonDisabled: "bg-slate-300 dark:bg-gray-800 text-slate-500 dark:text-gray-500",
    buttonActive: "bg-teal-700 dark:bg-blue-600 hover:bg-teal-800 dark:hover:bg-blue-700 text-white",
    listContainer: "bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-white",
    listItem: "hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-900 dark:text-white",
    listItemActive: "bg-teal-100 dark:bg-blue-900 text-slate-900 dark:text-white",
    content: "bg-slate-100 dark:bg-gray-800 text-slate-900 dark:text-white",
  },
} as const;

/** Type definitions for better TypeScript support */
export type ColourStyleKey = keyof typeof colourStyles;
