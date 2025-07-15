import React from "react";

/**
 * A reusable component for rendering superscript bracketed text.
 * Used for various Wikipedia template annotations like [citation needed], [who?], etc.
 */
export function Fix({ children }: { children: React.ReactNode }) {
  return <sup>[{children}]</sup>;
}
