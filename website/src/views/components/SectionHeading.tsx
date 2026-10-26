import React from "react";
import { colourStyles } from "../colours";
import { textStyles } from "../typography";

/** A panel's title: the display face, at a size that leads the panel. */
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
      className={`flex items-center gap-2 px-4 py-2.5 ${colourStyles.section.heading}`}
      style={style}
    >
      {icon && (
        <span className={`${colourStyles.text.secondary} shrink-0`}>
          {icon}
        </span>
      )}
      <h3
        className={`font-display font-semibold ${textStyles.heading} leading-tight tracking-[-0.012em]`}
      >
        {children}
      </h3>
    </div>
  );
}
