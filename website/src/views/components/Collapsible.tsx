import { useState } from "react";
import { colourStyles } from "../colours";
import { textStyles } from "../typography";
import { ChevronDownIcon } from "./icons";

/**
 * A collapsible component; the children are not rendered when collapsed.
 *
 * The header is a display-face row with a chevron and a rule under it, so a
 * closed section still reads as a heading you can open. With `showBorder` the
 * component is a panel in its own right; without it the component is a row
 * inside one, and supplies only the rule between rows.
 */
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

  const surface = showBorder
    ? colourStyles.bg.panel
    : `border-b ${colourStyles.border.divider}`;

  return (
    <div className={`overflow-hidden ${surface}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-2 text-left px-3 py-2.5 font-display ${textStyles.body} font-semibold tracking-[-0.008em] ${colourStyles.collapsible.header} transition-colors`}
        aria-expanded={isOpen}
      >
        <span
          className={`${colourStyles.text.secondary} w-4 flex-shrink-0 transition-transform duration-200 flex items-center justify-center`}
          style={{
            transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
          }}
        >
          <ChevronDownIcon width={14} height={14} />
        </span>
        <span className="flex-1">{title}</span>
      </button>
      {isOpen && (
        <div
          className={`px-4 py-3 ${textStyles.body} ${colourStyles.collapsible.content}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
