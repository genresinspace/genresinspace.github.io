import { WikipediaLink } from "./WikipediaLink";
import { GenreLink } from "../../links/GenreLink";
import { NodeData, nodeIdToInt, useDataContext } from "../../../data";

/**
 * A link to a Wikipedia page, or a genre link if the page title is a genre.
 */
export function WikipediaMaybeGenreLink({
  pageTitle,
  ...rest
}: React.ComponentProps<typeof WikipediaLink> & {
  nodes: NodeData[];
}) {
  const { links_to_page_ids: linksToPageId, nodes } = useDataContext();
  const nodeId = nodeIdToInt(linksToPageId[pageTitle.toLowerCase()]);
  const node = nodes[nodeId];
  if (node) {
    return <GenreLink node={node} {...rest} />;
  } else {
    return <WikipediaLink {...rest} pageTitle={pageTitle} />;
  }
}
