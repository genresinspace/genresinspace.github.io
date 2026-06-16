import React from "react";
import { colourStyles } from "../colours";
import { textStyles } from "../typography";

/** A single tab definition consumed by {@link Tabs}. */
export interface TabItem<T extends string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

/**
 * A flush row of tab buttons. Buttons touch (no horizontal gap) and the bar
 * has no vertical padding, so tab content can sit directly below.
 */
export function Tabs<T extends string>({
  items,
  activeId,
  onChange,
  className,
}: {
  items: readonly TabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      className={`flex shrink-0 ${colourStyles.bg.shell} border ${colourStyles.border.divider} ${className || ""}`}
    >
      {items.map((tab) => (
        <button
          key={tab.id}
          className={`flex-1 p-2 cursor-pointer flex items-center justify-center gap-2 overflow-hidden border-b-2 font-display ${textStyles.title} tracking-[0.08em] transition-colors duration-200 ${
            activeId === tab.id
              ? `font-bold ${colourStyles.button.active}`
              : `font-semibold ${colourStyles.button.inactive}`
          }`}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
