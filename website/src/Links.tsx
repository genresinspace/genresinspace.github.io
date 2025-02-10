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

export function InternalLink(props: React.ComponentProps<"a">) {
  return (
    <a
      {...props}
      className={`text-teal-400 hover:underline ${props.className ?? ""}`}
    />
  );
}
