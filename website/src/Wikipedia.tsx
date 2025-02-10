import { StyledLink } from "./StyledLink";
import Parser from "wikiparser-node";
import { JSX, useState } from "react";

const WIKIPEDIA_URL = "https://en.wikipedia.org/wiki";
Parser.config = "enwiki";

/**
 * @param {string} dumpDate - The date of the Wikipedia dump in YYYY-MM-DD format
 * @returns {string} URL to the Wikipedia dump directory
 */
export const dumpUrl = (dumpDate: string): string =>
  `https://dumps.wikimedia.org/enwiki/${dumpDate.split("-").join("")}/`;

export function WikipediaLink({
  pageTitle,
  ...rest
}: React.ComponentProps<"a"> & { pageTitle: string }) {
  return (
    <StyledLink
      {...rest}
      href={`${WIKIPEDIA_URL}/${pageTitle.replace(/ /g, "_")}`}
    />
  );
}

export function Wikitext(
  props: React.ComponentProps<"span"> & { wikitext: string }
) {
  const remappedAst = parseAndRemapWikitext(props.wikitext);
  if (!remappedAst) {
    return null;
  }
  return <WikitextNode node={remappedAst} />;
}

type WikitextNode =
  | { type: "fragment"; children: WikitextNode[] }
  | {
      type: "template";
      name: string;
      children: Extract<WikitextNode, { type: "parameter" }>[];
    }
  | { type: "parameter"; name: string; value: string }
  | { type: "link"; text: string; title: string }
  | { type: "ext-link"; text: string; link: string }
  | { type: "bold"; children: WikitextNode[] }
  | { type: "italic"; children: WikitextNode[] }
  | { type: "blockquote"; children: WikitextNode[] }
  | { type: "text"; text: string };

function parseAndRemapWikitext(wikitext: string): WikitextNode | null {
  return remapWikitextNode(Parser.parse(wikitext));
}

function dumpNodes(nodes: readonly Parser.AstNodes[], depth = 0) {
  for (const node of nodes) {
    let line = " ".repeat(depth * 2) + node.type;
    if (node.name) {
      line += `(${node.name})`;
    }
    line += `: ${node.text()}`;
    console.log(line);
    if (node.childNodes.length > 0) {
      dumpNodes(node.childNodes, depth + 1);
    }
  }
}

const DUMP_NODES =
  typeof window === "undefined" && process.env.DUMP_NODES === "1";
function remapWikitextNodes(nodes: readonly Parser.AstNodes[]): WikitextNode[] {
  if (DUMP_NODES) {
    dumpNodes(nodes);
  }

  const rootStack: (
    | (
        | { type: "fragment" }
        | { type: "bold" }
        | { type: "italic" }
        | { type: "blockquote" }
      ) & {
        children: WikitextNode[];
      }
  )[] = [{ type: "fragment", children: [] }];

  for (const node of nodes) {
    switch (node.type) {
      case "quote":
        let quoteNode = node as Parser.QuoteToken;
        if (quoteNode.bold && quoteNode.italic) {
          if (rootStack[rootStack.length - 1].type !== "italic") {
            rootStack.push({ type: "bold", children: [] });
            rootStack.push({ type: "italic", children: [] });
          } else {
            const italic = rootStack.pop()! as {
              type: "italic";
              children: WikitextNode[];
            };
            const bold = rootStack.pop()! as {
              type: "bold";
              children: WikitextNode[];
            };
            bold.children.push(italic);
            rootStack[rootStack.length - 1].children.push(bold);
          }
        } else if (quoteNode.bold) {
          if (rootStack[rootStack.length - 1].type !== "bold") {
            rootStack.push({ type: "bold", children: [] });
          } else {
            const bold = rootStack.pop()! as {
              type: "bold";
              children: WikitextNode[];
            };
            rootStack[rootStack.length - 1].children.push(bold);
          }
        } else if (quoteNode.italic) {
          if (rootStack[rootStack.length - 1].type !== "italic") {
            rootStack.push({ type: "italic", children: [] });
          } else {
            const italic = rootStack.pop()! as {
              type: "italic";
              children: WikitextNode[];
            };
            rootStack[rootStack.length - 1].children.push(italic);
          }
        }
        break;
      case "html":
        let htmlNode = node as Parser.HtmlToken;
        if (htmlNode.name === "blockquote") {
          if (htmlNode.closing) {
            const maybeBlockquote = rootStack.pop()!;
            if (maybeBlockquote.type !== "blockquote") {
              throw new Error(
                `Expected blockquote to be on top of stack; instead, found ${JSON.stringify(
                  maybeBlockquote,
                  null,
                  2
                )}`
              );
            }
            const blockquote = maybeBlockquote as {
              type: "blockquote";
              children: WikitextNode[];
            };
            rootStack[rootStack.length - 1].children.push(blockquote);
          } else {
            rootStack.push({ type: "blockquote", children: [] });
          }
        }
        break;
      default:
        const remappedNode = remapWikitextNode(node);
        if (remappedNode) {
          rootStack[rootStack.length - 1].children.push(remappedNode);
        }
    }
  }

  // This is a disgusting hack, but Wikipedia implicitly closes these, so we need to as well...
  while (rootStack.length > 1) {
    const popped = rootStack.pop()!;
    rootStack[rootStack.length - 1].children.push(popped);
  }
  return rootStack[0].children;
}

function remapWikitextNode(node: Parser.AstNodes): WikitextNode | null {
  switch (node.type) {
    case "root":
      return {
        type: "fragment",
        children: remapWikitextNodes(node.childNodes),
      };
    case "template":
      return {
        type: "template",
        name: node.name!.toLowerCase(),
        children: remapWikitextNodes(node.childNodes.slice(1)) as Extract<
          WikitextNode,
          { type: "parameter" }
        >[],
      };
    case "magic-word":
      // Making the current assumption that we don't care about these
      return null;
    case "parameter":
      const n = node as Parser.ParameterToken;
      return {
        type: "parameter",
        name: n.name,
        value: n.getValue(),
      };
    case "quote":
      // We can't do anything at this level
      return null;
    case "link": {
      const l = node as Parser.LinkToken;
      return {
        type: "link",
        text: l.innerText,
        title: l.link.title,
      };
    }
    case "ext-link": {
      const l = node as Parser.ExtLinkToken;
      return {
        type: "ext-link",
        text: l.innerText,
        link: l.link,
      };
    }
    case "text":
      return {
        type: "text",
        text: node.text(),
      };
    case "ext":
    case "category":
    case "comment":
    case "file":
      // Don't care
      return null;
    default:
      break;
  }
  throw new Error(`Unknown node type: ${node.type}: ${node.text()}`);
}

function WikitextNode({ node }: { node: WikitextNode }): JSX.Element {
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
    case "parameter":
      return <WikitextParameter node={node} />;
    case "link":
      return <WikipediaLink pageTitle={node.title}>{node.text}</WikipediaLink>;
    case "ext-link":
      return <StyledLink href={node.link}>{node.text}</StyledLink>;
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
        <blockquote>
          {node.children.map((child, i) => (
            <WikitextNode key={i} node={child} />
          ))}
        </blockquote>
      );
    case "text":
      return <>{node.text}</>;
  }
}

function templateToObject(
  template: Extract<WikitextNode, { type: "template" }>
) {
  return Object.fromEntries(template.children.map((c) => [c.name, c.value]));
}

function WikitextTemplate({
  node,
}: {
  node: Extract<WikitextNode, { type: "template" }>;
}) {
  const templateName = node.name.replace(/^template:/, "");
  switch (templateName) {
    case "nihongo":
      // TODO: consider replicating the other arguments of the template
      return <WikitextNode node={node.children[0]} />;
    case "'":
      return <>'</>;
    case `'_"`:
      return <>'"</>;
    case `-"`:
      return <>"</>;
    case "abbr":
    case "abbrlink":
      const abbr = node.children[0].value;
      const phrase = node.children[1]?.value;
      const jsx = <abbr title={phrase}>{abbr}</abbr>;
      if (templateName === "abbrlink") {
        return <WikipediaLink pageTitle={phrase}>{jsx}</WikipediaLink>;
      }
      return jsx;
    case "according_to_whom":
      return <sup>[according to whom]</sup>;
    case "blockquote":
    case "cquote":
      const params = templateToObject(node);
      const text = params.text || params["1"];
      if (!text) {
        return null;
      }

      const author = params.author || params["2"];
      const title = params.title || params["3"];
      const source = params.source || params["4"];
      const citationElements = [author, title, source]
        .filter((s) => s !== undefined)
        .map((s, i) => <Wikitext wikitext={s} key={i} />);
      const citation =
        citationElements.length === 0
          ? null
          : citationElements.reduce((prev, curr, i) => (
              <>
                {prev}
                {i > 0 && <>, </>}
                {curr}
              </>
            ));

      return (
        <figure>
          <blockquote>
            <Wikitext wikitext={text} />
          </blockquote>
          {citation && <figcaption>{citation}</figcaption>}
        </figure>
      );
    case "citation_needed":
    case "source_needed":
    case "cn":
    case "fact":
      return <sup>[citation needed]</sup>;
    case "clarify":
    case "clarification_needed":
      return <sup>[clarification needed]</sup>;
    case "clarify_span":
      return <sup>[clarify]</sup>;
    case "clear":
      // Not semantically meaningful
      return null;
    case "contradiction-inline":
    case "contradictory_inline":
      return <sup>[contradiction]</sup>;
    case "convert":
      // TODO: consider actually doing the conversion at some point
      return (
        <>
          <WikitextNode node={node.children[0]} />{" "}
          <WikitextNode node={node.children[1]} />
        </>
      );
    case "culture_of_colombia":
    case "culture_of_south_africa":
    case "culture_of_peru":
      // Category box: don't care
      return null;
    case "disputed":
      // Don't care about this notice
      return null;
    case "disputed_inline":
      return <sup>[disputed]</sup>;
    case "efn":
    case "efn-ua":
      return <WikipediaFootnote node={node.children[0]} />;
    case "em":
      return (
        <em>
          {node.children.map((child, i) => (
            <WikitextNode key={i} node={child} />
          ))}
        </em>
      );
    case "em_dash":
    case "emdash":
      return <>—</>;
    case "en_dash":
    case "endash":
    case "ndash":
      return <>–</>;
    case "failed_verification":
      return <sup>[failed verification]</sup>;
    case "igbo_topics":
      // Category box: don't care
      return null;
    case "ill":
      const pageTitle = node.children[0].value;
      return <WikipediaLink pageTitle={pageTitle}>{pageTitle}</WikipediaLink>;
    case "ipa":
    case "ipa-all":
      const ipa =
        node.children.length > 1 ? node.children[1] : node.children[0];
      // TODO: render properly, preferably with language support (the optional first argument, skipped above)
      return <code>{ipa.value}</code>;
    case "ipac-en":
      // TODO: implement. This is non-trivial because of all of the aliases:
      // https://en.wikipedia.org/wiki/Template:IPAc-en
      return <span>[English IPA pronunciation elided]</span>;
    case "irrelevant_citation":
      return <sup>[irrelevant citation]</sup>;
    case "korean":
      // TODO: support hanja/rr/etc, instead of assuming hangul
      return <span>Korean: {node.children[0].value}</span>;
    case "lang":
      // TODO: indicate language to browser / support rtl+italic+size
      return <span>{node.children[1].value}</span>;
    case "lang-rus":
      return (
        <span>
          Russian: {node.children[0].value}
          {node.children.length > 1 && `, romanized: ${node.children[1].value}`}
        </span>
      );
    case "lang-sr-cyrl":
      return <span>Serbian Cyrillic: {node.children[0].value}</span>;
    case "langx":
      // TODO: remap language codes to language names, support other parameters
      return (
        <span>
          {node.children[0].value}: {node.children[1].value}
        </span>
      );
    case "language_with_name/for":
    case "langnf":
      const langCode = node.children[0].value;
      const originalText = node.children[1].value;
      const translatedText = node.children[2].value;
      const langName = node.children.find((c) => c.name === "lang-name")?.value;
      return (
        <span>
          {originalText} ({langCode || langName} for '{translatedText}')
        </span>
      );
    case "linktext":
      // TODO: make each keyword linkable to Wikitionary
      return (
        <>
          {node.children
            .filter((c) => c.name !== "pref")
            .map((c) => c.value)
            .join("")}
        </>
      );
    case "listen":
      // TODO: implement, this could be quite important for this use case
      return null;
    case "lit":
    case "lit.":
    case "literally":
    case "literal_translation": {
      const params = node.children.filter((p) => p.name !== "lk");
      return <span>lit. {params.map((p) => `'${p.value}'`).join(" or ")}</span>;
    }
    case "multiple_image":
      // We don't render images from the description
      return null;
    case "music":
      return <span>music:{node.children[0].value}</span>;
    case "music_genre_stub":
    case "music-genre-stub":
      // Stub notice: don't care
      return null;
    case "music_of_cape_verde":
    // Category box: don't care
    case "music_of_jamaica":
    // Category box: don't care
    case "nastaliq":
      // Requesting a particular choice of fonts: not sure how to support
      return null;
    case "nbsp":
      return <>&nbsp;</>;
    case "not_a_typo":
    case "proper_name":
      return <>{node.children.map((c) => c.value).join("")}</>;
    case "nowrap":
      return (
        <span className="whitespace-nowrap">
          <WikitextNode node={node.children[0]} />
        </span>
      );
    case "pronunciation":
      // TODO: implement, this could be quite important for this use case
      return null;
    case "r":
    case "ref label":
    case "ref_label":
    case "refn":
    case "rp":
    case "sfn":
      // Don't care about references
      return null;
    case "respell":
      return (
        <span className="italic">
          {node.children.map((c) => c.value).join("-")}
        </span>
      );
    case "sic":
      return <>[sic]</>;
    case "smaller":
      return (
        <small>
          {node.children.map((c, i) => (
            <Wikitext wikitext={c.value} key={i} />
          ))}
        </small>
      );
    case "snd":
      return <> – </>;
    case "sources_exist":
      // Don't care about this notice
      return null;
    case "text-source_inline":
      return <sup>[text–source integrity?]</sup>;
    case "toc_limit":
    case "toclimit":
      return null;
    case "translation":
      // TODO: support meaning/second meaning/sortable/italic/literal
      return <span>transl.</span>;
    case "transliteration":
    case "transl":
      // TODO: support signalling language in some way
      return (
        <span>
          {node.children.length > 2
            ? node.children[2].value
            : node.children[1].value}
        </span>
      );
    case "use_dmy_dates":
    case "use_indian_english":
      // Don't care about these notices
      return null;
    case "verification_needed":
      return <sup>[verification needed]</sup>;
    case "when":
      return <sup>[when?]</sup>;
    case "which":
      return <sup>[which?]</sup>;
    case "who":
      return <sup>[who?]</sup>;
    case "wikibooks":
      // Book links not relevant to a description
      return null;
    case "lang-zh":
    case "zh":
      const texts = node.children
        .map((c) => {
          switch (c.name) {
            case "t":
              return `traditional Chinese: ${c.value}`;
            case "s":
              return `simplified Chinese: ${c.value}`;
            case "c":
              return `Chinese: ${c.value}`;
            case "p":
              return `pinyin: ${c.value}`;
            case "tp":
              return `Tongyong Pinyin: ${c.value}`;
            case "w":
              return `Wade–Giles: ${c.value}`;
            case "j":
              return `Jyutping: ${c.value}`;
            case "cy":
              return `Cantonese Yale: ${c.value}`;
            case "sl":
              return `Sidney Lau: ${c.value}`;
            case "poj":
              return `Pe̍h-ōe-jī: ${c.value}`;
            case "tl":
              return `Tâi-lô: ${c.value}`;
            case "zhu":
              return `Zhuyin Fuhao: ${c.value}`;
            case "l":
              return `lit. '${c.value}'`;
            case "tr":
              return `trans. "${c.value}"`;
            default:
              return null;
          }
        })
        .filter((t) => t !== null)
        .join("; ");
      return <span>{texts}</span>;
    default:
      throw new Error(
        `Unknown template: ${WIKIPEDIA_URL}/Template:${templateName}`
      );
  }
}

function WikitextParameter({
  node,
}: {
  node: Extract<WikitextNode, { type: "parameter" }>;
}) {
  if (!node.value) {
    return null;
  }
  return <Wikitext wikitext={node.value} />;
}

function WikipediaFootnote({ node }: { node: WikitextNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <sup>
      <button onClick={() => setVisible(!visible)}>
        [{visible ? <WikitextNode node={node} /> : "show"}]
      </button>
    </sup>
  );
}
