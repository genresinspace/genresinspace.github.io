import { WikipediaLink } from "../wikipedia/links/WikipediaLink";

/**
 * A link to a genre, including a link to the Wikipedia page for the genre.
 *
 * Will navigate to the genre in the graph.
 */
export function GenreLink({
  genreId,
  pageTitle,
  ...props
}: Omit<React.ComponentProps<"a">, "href"> & {
  genreId: string;
  pageTitle: string;
}) {
  return (
    <span>
      <a
        {...props}
        href={`#${genreId}`}
        className={`text-teal-400 hover:underline ${props.className ?? ""}`}
      >
        {props.children}
      </a>
      <sup>
        <WikipediaLink pageTitle={pageTitle}>wp</WikipediaLink>
      </sup>
    </span>
  );
}
