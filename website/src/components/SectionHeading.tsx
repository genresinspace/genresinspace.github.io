import React from "react";

/** Reusable component for section headings with optional icon */
export function SectionHeading({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-3 pb-1 border-b border-neutral-700">
      {icon && <span className="text-neutral-300">{icon}</span>}
      <h3 className="text-lg font-semibold text-neutral-200">{children}</h3>
    </div>
  );
}
