import { useState } from "react";
import { colourStyles } from "../colours";

/**
 * Renders a collapsible footnote.
 */
export function Footnote({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  const body = visible ? (
    <span
      className={`block p-2 my-2 ${colourStyles.footnote.background} rounded-lg border ${colourStyles.border.divider}`}
    >
      {children}
      <sup>
        <button
          onClick={() => setVisible(false)}
          className={colourStyles.text.toggle}
        >
          [hide]
        </button>
      </sup>
    </span>
  ) : (
    <sup>
      <button
        onClick={() => setVisible(true)}
        className={colourStyles.text.toggle}
      >
        [show]
      </button>
    </sup>
  );

  return <span className="font-normal">{body}</span>;
}
