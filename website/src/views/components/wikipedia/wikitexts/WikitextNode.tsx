import { JSX } from "react";
import { WikitextSimplifiedNode } from "frontend_wasm";
import { Wikitext } from "./Wikitext";
import { WikitextTemplate } from "../templates/WikitextTemplate";
import { WikipediaMaybeGenreLink } from "../links/WikipediaMaybeGenreLink";
import { ExternalLink } from "../../links/ExternalLink";
import { Blockquote } from "../../Blockquote";
import { WikitextNodes } from "./WikitextNodes";

/** Renders a `WikitextSimplifiedNode`. */
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
    case "unordered-list":
      return (
        <ul>
          {node.items.map((item, i) => (
            <WikitextNodes key={i} nodes={item.content} />
          ))}
        </ul>
      );
    case "ordered-list":
      return (
        <ol>
          {node.items.map((item, i) => (
            <WikitextNodes key={i} nodes={item.content} />
          ))}
        </ol>
      );
    case "definition-list":
      return (
        <dl>
          {node.items.map((item, i) =>
            item.type_ === "Term" ? (
              <dt key={i}>
                <WikitextNodes nodes={item.content} />
              </dt>
            ) : (
              <dd key={i}>
                <WikitextNodes nodes={item.content} />
              </dd>
            )
          )}
        </dl>
      );
    case "table":
      return (
        <table>
          <thead>
            <tr>
              {node.captions.map((caption, i) => (
                <WikitextNodes key={i} nodes={caption.content} />
              ))}
            </tr>
          </thead>
          <tbody>
            {node.rows.map((row, i) => (
              <tr key={i}>
                {row.cells.map((cell, j) => (
                  <td key={j}>
                    <WikitextNodes nodes={cell.content} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "horizontal-divider":
      return <hr />;
    case "template-parameter-use":
    case "heading":
    case "tag":
    case "redirect":
      return <></>;
    default:
      return node satisfies never;
  }
}
