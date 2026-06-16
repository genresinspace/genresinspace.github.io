/**
 * Centralized text-size scale for the application.
 *
 * Every font size in the UI maps to one of these named roles, so the whole
 * type scale can be retuned from this single file. Change a role's Tailwind
 * size class here and adjust component layouts to match — there should be no
 * bare `text-<size>` classes anywhere else in the app.
 *
 * Two intentional exceptions live outside this scale:
 *  - the audio "Listen" template sizes an icon glyph (not text) with text-2xl;
 *  - rendered Wikipedia content keeps its own native <small> markup.
 */
export const textStyles = {
  /** Large display text — the landing / loading title. */
  display: "text-3xl",
  /** Section headings (the cartouche strips on each plate). */
  heading: "text-xl",
  /** Tab labels and similarly prominent affordances. */
  title: "text-lg",
  /** Default body, reading, and UI text. */
  body: "text-base",
  /** Captions, metadata, ornaments, and other small print. */
  small: "text-sm",
} as const;

/** Type definitions for better TypeScript support */
export type TextStyleKey = keyof typeof textStyles;
