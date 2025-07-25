import { useState } from "react";
import { colourStyles } from "../colours";

/**
 * Renders a collapsible footnote.
 */
export function Footnote({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  const body = visible ? (
    <span
      className={`block p-2 my-2 ${colourStyles.footnote.background} rounded border border-neutral-700`}
    >
      {children}
      <sup>
        <button
          onClick={() => setVisible(false)}
          className="text-neutral-400 hover:text-white"
        >
          [hide]
        </button>
      </sup>
    </span>
  ) : (
    <sup>
      <button
        onClick={() => setVisible(true)}
        className="text-neutral-400 hover:text-white"
      >
        [show]
      </button>
    </sup>
  );

  return <span className="font-normal">{body}</span>;
}
