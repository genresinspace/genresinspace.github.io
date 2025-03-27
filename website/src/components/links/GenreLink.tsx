/**
 * A link to a genre.
 *
 * Will navigate to the genre in the graph.
 */
export function GenreLink({
  node,
  ...props
}: Omit<React.ComponentProps<"a">, "href"> & {
  node: NodeData;
}) {
  return (
    <span>
      <a
        {...props}
        href={`#${node.id}`}
        className={`text-teal-400 ${props.className ?? ""}`}
      >
        ♪ {props.children}
      </a>
    </span>
  );
}
