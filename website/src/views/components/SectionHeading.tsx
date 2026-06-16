import React from "react";
import { colourStyles } from "../colours";
import { textStyles } from "../typography";

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
      className={`flex items-center gap-2.5 px-3 py-2 w-full ${colourStyles.section.heading}`}
      style={style}
    >
      {icon && (
        <span className={`${colourStyles.text.secondary} opacity-80`}>
          {icon}
        </span>
      )}
      <h3
        className={`font-display font-semibold ${textStyles.heading} leading-tight tracking-[0.14em]`}
      >
        {children}
      </h3>
      {/* hairline rule trailing off like a chart cartouche */}
      <span
        aria-hidden
        className={`flex-1 border-t ${colourStyles.border.light} opacity-60`}
      />
      <span
        aria-hidden
        className={`${textStyles.small} ${colourStyles.text.brass}`}
      >
        ✦
      </span>
    </div>
  );
}
