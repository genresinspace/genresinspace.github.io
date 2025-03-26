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
        className={`text-teal-400 hover:underline ${props.className ?? ""}`}
      >
        {props.children}
      </a>
    </span>
  );
}
