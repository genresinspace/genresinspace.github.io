import {
  nodeColour,
  NodeColourLightness,
  NodeData,
  useDataContext,
} from "../../../data";

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
  const { max_degree: maxDegree } = useDataContext();

  const [genreColour, genreColourHover] = [
    NodeColourLightness.LinkText,
    NodeColourLightness.LinkTextHover,
  ].map((lightness) => nodeColour(node, maxDegree, lightness, 30));

  return (
    <span>
      <a
        {...props}
        href={`#${node.id}`}
        className={`text-[var(--node-color)] hover:text-[var(--node-color-hover)] ${props.className ?? ""}`}
        style={{
          ["--node-color" as string]: genreColour,
          ["--node-color-hover" as string]: genreColourHover,
        }}
      >
        ♪ {props.children}
      </a>
    </span>
  );
}
