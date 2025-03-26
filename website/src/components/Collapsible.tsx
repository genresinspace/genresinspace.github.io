import { useState } from "react";

/** A collapsible component; the children are not rendered when collapsed. */
export function Collapsible({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-neutral-800 rounded-md overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 text-lg font-bold p-1 px-2 bg-neutral-800/50 hover:bg-neutral-800 transition-colors"
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
        <span>{title}</span>
      </button>
      {isOpen && <div className="p-3">{children}</div>}
    </div>
  );
}
