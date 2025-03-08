import { JSX } from "react";
import { WikitextSimplifiedNode } from "wikitext_simplified";
import { Wikitext } from "./Wikitext";
import { WikitextTemplate } from "../templates/WikitextTemplate";
import { WikipediaMaybeGenreLink } from "../links/WikipediaMaybeGenreLink";
import { ExternalLink } from "../../links/ExternalLink";
import { Blockquote } from "../../Blockquote";

export function WikitextNode({
  node,
}: {
  node: WikitextSimplifiedNode;
}): JSX.Element {
  switch (node.type) {
    case "fragment":
      return (
        <>
          {node.children.map((child, i) => (
            <WikitextNode key={i} node={child} />
          ))}
        </>
      );
    case "template":
      return <WikitextTemplate node={node} />;
    case "link":
      return (
        <WikipediaMaybeGenreLink pageTitle={node.title}>
          <Wikitext wikitext={node.text} />
        </WikipediaMaybeGenreLink>
      );
    case "ext-link":
      return (
        <ExternalLink href={node.link}>
          <Wikitext wikitext={node.text ?? node.link} />
        </ExternalLink>
      );
    case "bold":
      return (
        <strong>
          {node.children.map((child, i) => (
            <WikitextNode key={i} node={child} />
          ))}
        </strong>
      );
    case "italic":
      return (
        <em>
          {node.children.map((child, i) => (
            <WikitextNode key={i} node={child} />
          ))}
        </em>
      );
    case "blockquote":
      return (
        <Blockquote>
          {node.children.map((child, i) => (
            <WikitextNode key={i} node={child} />
          ))}
        </Blockquote>
      );
    case "superscript":
      return (
        <sup>
          {node.children.map((child, i) => (
            <WikitextNode key={i} node={child} />
          ))}
        </sup>
      );
    case "subscript":
      return (
        <sub>
          {node.children.map((child, i) => (
            <WikitextNode key={i} node={child} />
          ))}
        </sub>
      );
    case "small":
      return (
        <small>
          {node.children.map((child, i) => (
            <WikitextNode key={i} node={child} />
          ))}
        </small>
      );
    case "preformatted":
      return (
        <pre>
          {node.children.map((child, i) => (
            <WikitextNode key={i} node={child} />
          ))}
        </pre>
      );
    case "text":
      return <>{node.text}</>;
    case "paragraph-break":
      return (
        <>
          <br />
          <br />
        </>
      );
    case "newline":
      return <br />;
  }
}
