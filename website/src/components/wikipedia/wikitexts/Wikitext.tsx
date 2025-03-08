import { parse_and_simplify_wikitext } from "wikitext_simplified";
import { WikitextNodes } from "./WikitextNodes";

/**
 * Renders a Wikitext string.
 */
export function Wikitext(props: { wikitext: string }) {
  const nodes = parse_and_simplify_wikitext(props.wikitext);
  return <WikitextNodes nodes={nodes} />;
}
