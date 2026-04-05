import React from "react";
import { colourStyles } from "../colours";

/** Reusable component for section headings with optional icon */
export function SectionHeading({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-2 p-2 w-full ${colourStyles.section.heading}`}
    >
      {icon && <span className={colourStyles.text.icon}>{icon}</span>}
      <h3 className="text-lg font-bold">{children}</h3>
    </div>
  );
}
