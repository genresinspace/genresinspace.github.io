// Centralized color styles for the application
// All bg- Tailwind classes are defined here for easy management

// Centralized color styles - all bg- classes inlined here
export const colourStyles = {
  // Main application backgrounds
  app: {
    background: "bg-neutral-900",
  },

  // Sidebar styles
  sidebar: {
    background: "bg-neutral-900",
    hover: "hover:bg-neutral-800",
    resizer: "bg-neutral-700 hover:bg-neutral-600",
    resizerActive: "bg-neutral-600",
    itemActive: "bg-amber-800 font-bold",
    itemInactive: "bg-neutral-900 hover:bg-neutral-800",
  },

  // Node styles
  node: {
    background: "bg-[var(--node-color)]",
    hover: "hover:filter hover:brightness-[1.6]",
    infoBackground: "bg-neutral-800",
    buttonActive: "bg-violet-600 font-bold",
    buttonInactive: "bg-gray-700 hover:bg-gray-600",
  },

  // Project information styles
  project: {
    button: "bg-slate-700 hover:bg-slate-600",
    title: "bg-[var(--node-color)] hover:bg-[var(--node-hovered-color)]",
    subtitle: "bg-[var(--node-color)]",
  },

  // Search styles
  search: {
    container: "bg-neutral-700",
    button: "bg-neutral-700 hover:bg-neutral-600",
    input: "bg-neutral-700",
    results: "bg-neutral-700",
    item: "bg-neutral-900 hover:bg-neutral-700",
  },

  // Wikipedia component styles
  wikitext: {
    button: "bg-neutral-800 hover:bg-neutral-700",
    inline: "bg-neutral-800 hover:bg-neutral-700",
  },

  // Audio/Listen component styles
  audio: {
    button: "bg-neutral-700 hover:bg-neutral-600",
    progress: "bg-neutral-700",
    container: "bg-neutral-900",
  },

  // Tooltip styles
  tooltip: {
    background: "bg-neutral-950",
  },

  // Section styles
  section: {
    heading: "bg-gray-800",
  },

  // Notice styles
  notice: {
    yellow: "bg-yellow-100/90",
    red: "bg-red-100/90",
    blue: "bg-blue-100/90",
    green: "bg-green-100/90",
  },

  // Input styles
  input: {
    primary: "bg-amber-700 hover:bg-amber-600",
    label: "bg-gray-700",
    secondary: "bg-amber-700 hover:bg-amber-600",
  },

  // Footnote styles
  footnote: {
    background: "bg-neutral-800",
  },

  // Collapsible styles
  collapsible: {
    background: "bg-neutral-800/50 hover:bg-neutral-800",
  },

  // Asset icon styles (from assets/icon.html)
  icon: {
    body: "bg-black",
    sidebar: "bg-gray-900",
    input: "bg-gray-800",
    button: "bg-gray-700 hover:bg-gray-600",
    buttonPrimary: "bg-blue-700 hover:bg-blue-600",
    buttonDisabled: "bg-gray-800",
    buttonActive: "bg-blue-600 hover:bg-blue-700",
    listContainer: "bg-gray-950",
    listItem: "hover:bg-gray-800",
    listItemActive: "bg-blue-900",
    content: "bg-gray-800",
  },
} as const;

// Type definitions for better TypeScript support
export type ColourStyleKey = keyof typeof colourStyles;
