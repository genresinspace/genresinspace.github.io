export function StyledLink(props: React.ComponentProps<"a">) {
  return (
    <a
      {...props}
      className={`text-blue-400 hover:underline ${props.className ?? ""}`}
    />
  );
}
