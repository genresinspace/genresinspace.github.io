import { useContext } from "react";
import { WikipediaLink } from "./WikipediaLink";
import { LinksToPageIdContext } from "../../../App";
import { GenreLink } from "../../links/GenreLink";

/**
 * A link to a Wikipedia page, or a genre link if the page title is a genre.
 */
export function WikipediaMaybeGenreLink({
  pageTitle,
  ...rest
}: React.ComponentProps<typeof WikipediaLink>) {
  const linksToPageId = useContext(LinksToPageIdContext);
  const pageId = linksToPageId[pageTitle.toLowerCase()];
  if (pageId) {
    return <GenreLink genreId={pageId} pageTitle={pageTitle} {...rest} />;
  } else {
    return <WikipediaLink {...rest} pageTitle={pageTitle} />;
  }
}
