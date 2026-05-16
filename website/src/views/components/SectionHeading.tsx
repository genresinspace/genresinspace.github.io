import React from "react";
import { colourStyles } from "../colours";

/** Reusable component for section headings with optional icon */
export function SectionHeading({
  children,
  icon,
  style,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  /** Inline style override (e.g. for a dynamic background colour). */
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`flex items-center gap-2 p-2 w-full ${colourStyles.section.heading}`}
      style={style}
    >
      {icon && <span className={colourStyles.text.secondary}>{icon}</span>}
      <h3 className="text-lg font-bold">{children}</h3>
    </div>
  );
}
