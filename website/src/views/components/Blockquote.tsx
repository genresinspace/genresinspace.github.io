import { colourStyles } from "../colours";

/**
 * Renders a blockquote.
 */
export function Blockquote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote
      className={`pl-4 m-0 border-l-4 ${colourStyles.blockquote.border} italic ${colourStyles.blockquote.text} inline-block`}
    >
      {children}
    </blockquote>
  );
}
