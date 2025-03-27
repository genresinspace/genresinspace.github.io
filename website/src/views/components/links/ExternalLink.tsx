/**
 * A link to an external URL that opens in a new tab.
 */
export function ExternalLink({
  nostyle,
  ...props
}: React.ComponentProps<"a"> & { nostyle?: boolean }) {
  return (
    <a
      {...props}
      className={
        nostyle
          ? props.className
          : `text-blue-400 hover:underline ${props.className ?? ""}`
      }
      target="_blank"
      rel="noopener noreferrer"
    />
  );
}
