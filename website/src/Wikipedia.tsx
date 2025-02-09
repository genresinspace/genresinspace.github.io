import wtf from "wtf_wikipedia";
import { StyledLink } from "./StyledLink";

const WIKIPEDIA_URL = "https://en.wikipedia.org/wiki";

/**
 * @param {string} dumpDate - The date of the Wikipedia dump in YYYY-MM-DD format
 * @returns {string} URL to the Wikipedia dump directory
 */
export const dumpUrl = (dumpDate: string) =>
  `https://dumps.wikimedia.org/enwiki/${dumpDate.split("-").join("")}/`;

export function WikipediaLink(
  props: React.ComponentProps<"a"> & { pageTitle: string }
) {
  return (
    <StyledLink
      {...props}
      href={`${WIKIPEDIA_URL}/${props.pageTitle.replace(/ /g, "_")}`}
    />
  );
}

export function Wikitext(
  props: React.ComponentProps<"span"> & { wikitext: string }
) {
  // TODO: actually parse and render the wikitext :sob:
  return <span {...props}>{wtf(props.wikitext).text()}</span>;
}
