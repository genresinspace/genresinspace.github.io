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
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-lg font-bold"
      >
        {isOpen ? "▼" : "▶"} {title}
      </button>
      {isOpen && children}
    </div>
  );
}
