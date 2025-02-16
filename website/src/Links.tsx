import { WikipediaLink } from "./Wikipedia";

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
