import React, { useContext, useEffect } from "react";
import { ExternalLink, GenreLink } from "./Links";
import { JSX, useState } from "react";
import init, {
  parse_and_simplify_wikitext,
  WikitextSimplifiedNode,
} from "wikitext_simplified";
import { LinksToPageIdContext, WikipediaMetaContext } from "./App";

export const initWasm = async (binary?: Buffer) => {
  return init({ module_or_path: binary });
};

/**
 * @param {string} dumpDate - The date of the Wikipedia dump in YYYY-MM-DD format
 * @returns {string} URL to the Wikipedia dump directory
 */
export const dumpUrl = (databaseName: string, dumpDate: string): string =>
  `https://dumps.wikimedia.org/${databaseName}/${dumpDate
    .split("-")
    .join("")}/`;

export const useWikiUrl = () => {
  const meta = useContext(WikipediaMetaContext);
  if (!meta) {
    return null;
  }
  return `https://${meta.domain}/wiki`;
};

/**
 * A link to a Wikipedia page.
 */
export function WikipediaLink({
  pageTitle,
  ...rest
}: React.ComponentProps<"a"> & { pageTitle: string }) {
  const wikiUrl = useWikiUrl();
  if (!wikiUrl) {
    return null;
  }

  return (
    <ExternalLink
      {...rest}
      href={`${wikiUrl}/${pageTitle.replace(/ /g, "_")}`}
    />
  );
}

/**
 * A link to a Wikipedia page, or a genre link if the page title is a genre.
 */
export function WikipediaMaybeGenreLink({
  pageTitle,
  ...rest
}: React.ComponentProps<typeof WikipediaLink>) {
  const linksToPageId = useContext(LinksToPageIdContext);
  const pageId = linksToPageId[pageTitle.toLowerCase()];
  if (pageId) {
    return <GenreLink genreId={pageId} pageTitle={pageTitle} {...rest} />;
  } else {
    return <WikipediaLink {...rest} pageTitle={pageTitle} />;
  }
}

/**
 * Determines whether this node can be used to break a short description.
 */
function isShortWikitextBreak(node: WikitextSimplifiedNode): boolean {
  return node.type === "paragraph-break" || node.type === "newline";
}

/**
 * Like `Wikitext`, but only renders up to the first paragraph break or newline.
 */
export function ShortWikitext(props: {
  wikitext: string;
  expandable: boolean;
}) {
  const nodes = parse_and_simplify_wikitext(props.wikitext);
  const index = nodes.findIndex(isShortWikitextBreak);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [props.wikitext]);

  return (
    <div className="flex flex-col gap-2">
      <div>
        <WikitextNodes
          nodes={index !== -1 && !expanded ? nodes.slice(0, index) : nodes}
        />
      </div>
      {index !== -1 && props.expandable && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full p-2 text-sm text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-md mx-auto block transition-colors"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

/**
 * Like `Wikitext`, but renders up to a character limit before truncating with a `...` suffix.
 */
export function WikitextWithEllipsis(props: {
  wikitext: string;
  length: number;
}) {
  function estimateNodeLength(node: WikitextSimplifiedNode): number {
    switch (node.type) {
      case "template":
        // this is so bad
        return (
          node.children.map((p) => p.value.length).reduce((a, b) => a + b, 0) /
          Math.max(node.children.length, 1)
        );
      case "link":
        return node.text.length;
      case "ext-link":
        return node.text.length;
      case "fragment":
      case "bold":
      case "italic":
      case "blockquote":
      case "superscript":
      case "subscript":
      case "small":
      case "preformatted":
        return node.children.map(estimateNodeLength).reduce((a, b) => a + b, 0);
      case "text":
        return node.text.length;
      default:
        return 0;
    }
  }

  const originalNodes = parse_and_simplify_wikitext(props.wikitext);

  let nodes: WikitextSimplifiedNode[] = [];
  let length = 0;
  for (const node of originalNodes) {
    if (isShortWikitextBreak(node)) {
      break;
    }
    const nodeLength = estimateNodeLength(node);
    if (length + nodeLength > props.length) {
      break;
    }
    nodes.push(node);
    length += nodeLength;
  }

  if (nodes.length < originalNodes.length) {
    // if the node after the truncated node is text, make an attempt to truncate it
    // to produce *some* output
    const nextNode = originalNodes[nodes.length];
    if (nextNode.type === "text") {
      nodes.push({
        type: "text",
        text: nextNode.text.slice(0, props.length - length),
      });
    }

    nodes.push({ type: "text", text: "..." });
  }

  return <WikitextNodes nodes={nodes} />;
}

export function Wikitext(props: { wikitext: string }) {
  const nodes = parse_and_simplify_wikitext(props.wikitext);
  return <WikitextNodes nodes={nodes} />;
}

function WikitextNodes({
  nodes,
}: {
  nodes: WikitextSimplifiedNode[];
}): JSX.Element {
  return (
    <>
      {nodes.map((node, i) => (
        <WikitextNode key={i} node={node} />
      ))}
    </>
  );
}

function WikitextNode({ node }: { node: WikitextSimplifiedNode }): JSX.Element {
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
          {node.text}
        </WikipediaMaybeGenreLink>
      );
    case "ext-link":
      return <ExternalLink href={node.link}>{node.text}</ExternalLink>;
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

function templateToObject(
  template: Extract<WikitextSimplifiedNode, { type: "template" }>
) {
  return Object.fromEntries(template.children.map((c) => [c.name, c.value]));
}

function WikitextTemplate({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  const wikiUrl = useWikiUrl();

  const templateName = node.name
    .replace(/^template:/, "")
    .replace(/ /g, "_")
    .toLowerCase();
  switch (templateName) {
    case "nihongo":
      // TODO: consider replicating the other arguments of the template
      return <Wikitext wikitext={node.children[0].value}></Wikitext>;
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
        return (
          <WikipediaMaybeGenreLink pageTitle={phrase}>
            {jsx}
          </WikipediaMaybeGenreLink>
        );
      }
      return jsx;
    case "according_to_whom":
      return <sup>[according to whom]</sup>;
    case "anchor":
      // We don't need to emit anchors in our output
      return null;
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
      const citation = [author, title, source]
        .filter((s) => s !== undefined)
        .join(" ");

      return (
        <figure>
          <Blockquote>{text}</Blockquote>
          {citation && <figcaption>{citation}</figcaption>}
        </figure>
      );
    case "citation_needed":
    case "source_needed":
    case "cn":
    case "fact":
    case "citesource":
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
          {node.children[0].value} {node.children[1].value}
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
      return <WikipediaFootnote node={node.children[0].value} />;
    case "em":
      return (
        <em>
          {node.children.map((child, i) => (
            <React.Fragment key={i}>{child.value}</React.Fragment>
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
      return (
        <WikipediaMaybeGenreLink pageTitle={pageTitle}>
          {pageTitle}
        </WikipediaMaybeGenreLink>
      );
    case "ipa":
      const ipa =
        node.children.length > 1 ? node.children[1] : node.children[0];
      // TODO: render properly, preferably with language support (the optional first argument, skipped above)
      return <code>{ipa.value}</code>;
    case "ipa-all":
      // As it turns out, this template was actually deleted between the dump I started working with and
      // when I started this project. Unfortunately, this means we still have to handle it.
      return <code>{node.children[0].value}</code>;
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
    case "lang-su-fonts":
    case "sund":
      return <Wikitext wikitext={node.children[0].value} />;
    case "langx":
      // TODO: remap language codes to language names, support other parameters
      return (
        <span>
          {node.children[0].value}:{" "}
          <Wikitext wikitext={node.children[1].value} />
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
    case "mongolunicode": {
      const text = node.children.find((p) => p.name === "1");
      if (!text) return null;

      const direction =
        node.children.find((p) => p.name === "2")?.value === "h"
          ? "horizontal-tb"
          : "vertical-rl";
      // We don't currently do anything to handle fonts, but we could in the future
      // const lang = node.children.find((p) => p.name === "lang")?.value || "mn";
      const style = node.children.find((p) => p.name === "style")?.value || "";
      const fontSize = node.children.find((p) => p.name === "font-size")?.value;
      const lineHeight = node.children.find(
        (p) => p.name === "line-height"
      )?.value;
      const display = node.children.find((p) => p.name === "display")?.value;

      return (
        <span
          style={{
            writingMode: direction,
            ...(fontSize && { fontSize }),
            ...(lineHeight && { lineHeight }),
            ...(display && { display }),
            ...(style && { style }),
          }}
        >
          <Wikitext wikitext={text.value} />
        </span>
      );
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
    case "noitalic":
      return <span className="font-normal">{node.children[0].value}</span>;
    case "nowrap":
      return (
        <span className="whitespace-nowrap">{node.children[0].value}</span>
      );
    case "page_needed":
      return <sup>[page needed]</sup>;
    case "pronunciation":
      // TODO: implement, this could be quite important for this use case
      return null;
    case "r":
    case "ref label":
    case "ref_label":
    case "refn":
    case "rp":
    case "sfn":
    case "#tag:ref":
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
            <React.Fragment key={i}>{c.value}</React.Fragment>
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
        .filter((c) => c.value.length > 0)
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
        `Unknown template: ${wikiUrl ?? ""}/Template:${templateName}`
      );
  }
}

function WikipediaFootnote({ node }: { node: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <sup>
      <button onClick={() => setVisible(!visible)}>
        [{visible ? node : "show"}]
      </button>
    </sup>
  );
}

function Blockquote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="pl-4 m-0 border-l-4 border-gray-300 dark:border-gray-700 italic text-gray-700 dark:text-gray-300 inline-block">
      {children}
    </blockquote>
  );
}
