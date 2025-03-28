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
    <div className="flex items-center gap-2 px-2 pt-2 pb-1 w-full bg-gray-800 border-b-6 border-gray-700 text-white">
      {icon && <span className="text-neutral-300">{icon}</span>}
      <h3 className="text-lg font-bold">{children}</h3>
    </div>
  );
}
