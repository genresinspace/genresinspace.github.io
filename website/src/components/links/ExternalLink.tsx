/**
 * A link to an external URL that opens in a new tab.
 */
export function ExternalLink(props: React.ComponentProps<"a">) {
  return (
    <a
      {...props}
      className={`text-blue-400 hover:underline ${props.className ?? ""}`}
      target="_blank"
      rel="noopener noreferrer"
    />
  );
}
