/**
 * A link to a genre.
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
        className={`text-teal-400 ${props.className ?? ""}`}
      >
        <span className="inline-flex items-center hover:underline">
          <span className="mr-1 flex items-center" title="Genre link">
            ♪
          </span>
          {props.children}
        </span>
      </a>
    </span>
  );
}
