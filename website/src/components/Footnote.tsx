import { useState } from "react";

/**
 * Renders a collapsible footnote.
 */
export function Footnote({ node }: { node: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <sup>
      <button onClick={() => setVisible(!visible)}>
        [{visible ? node : "show"}]
      </button>
    </sup>
  );
}
