import React from "react";
import { colourStyles } from "../colours";

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
}: {
  items: readonly TabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex shrink-0">
      {items.map((tab) => (
        <button
          key={tab.id}
          className={`flex-1 p-2 cursor-pointer flex items-center justify-center gap-2 overflow-hidden transition-colors duration-200 ${
            activeId === tab.id
              ? colourStyles.button.active
              : colourStyles.button.inactive
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
