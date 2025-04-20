import { parse_and_simplify_wikitext } from "frontend_wasm";
import { WikitextNodes } from "./WikitextNodes";

/**
 * Renders a Wikitext string.
 */
export function Wikitext(props: { wikitext: string }) {
  const nodes = parse_and_simplify_wikitext(props.wikitext);
  return <WikitextNodes nodes={nodes} />;
}
