import { useState } from "react";
import { colourStyles } from "../colours";

/** A collapsible component; the children are not rendered when collapsed. */
export function Collapsible({
  title,
  children,
  defaultOpen = false,
  showBorder = true,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  showBorder?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className={`${showBorder ? "border border-neutral-800" : ""} overflow-hidden`}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-start gap-2 text-md font-bold p-2 ${colourStyles.collapsible.background} transition-colors`}
        aria-expanded={isOpen}
      >
        <span
          className="text-sm w-4 flex-shrink-0 transition-transform duration-200"
          style={{
            transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
          }}
        >
          ▼
        </span>
        <span className="text-left">{title}</span>
      </button>
      {isOpen && <div className="p-3">{children}</div>}
    </div>
  );
}
