import React from "react";
import { ExternalLink, InternalLink } from "./Links";
import { JSX, useState } from "react";

const WIKIPEDIA_URL = "https://en.wikipedia.org/wiki";

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
    <ExternalLink
      {...rest}
      href={`${WIKIPEDIA_URL}/${pageTitle.replace(/ /g, "_")}`}
    />
  );
}

/**
 * Determines whether this node can be used to break a short description.
 */
export function isShortWikitextBreak(node: WikitextNode): boolean {
  return node.type === "paragraph_break" || node.type === "newline";
}

/**
 * Like `Wikitext`, but only renders up to the first paragraph break or newline.
 */
export function ShortWikitext(
  props: React.ComponentProps<"span"> & { wikitext: WikitextNode[] }
) {
  let index: number | undefined =
    props.wikitext.findIndex(isShortWikitextBreak);
  if (index === -1) {
    index = undefined;
  }

  return (
    <Wikitext
      wikitext={index ? props.wikitext.slice(0, index) : props.wikitext}
    />
  );
}

export function Wikitext(
  props: React.ComponentProps<"span"> & { wikitext: WikitextNode[] }
) {
  return (
    <>
      {props.wikitext.map((node, i) => (
        <WikitextNode key={i} node={node} />
      ))}
    </>
  );
}

export type WikitextNode =
  | { type: "fragment"; children: WikitextNode[] }
  | {
      type: "template";
      name: string;
      children: { type: "parameter"; name: string; value: string }[];
    }
  | {
      type: "link";
      text: string;
      title: string;
      // We love a good leaky abstraction
      genre_id?: string;
    }
  | { type: "ext-link"; text: string; link: string }
  | { type: "bold"; children: WikitextNode[] }
  | { type: "italic"; children: WikitextNode[] }
  | { type: "blockquote"; children: WikitextNode[] }
  | { type: "superscript"; children: WikitextNode[] }
  | { type: "subscript"; children: WikitextNode[] }
  | { type: "small"; children: WikitextNode[] }
  | { type: "preformatted"; children: WikitextNode[] }
  | { type: "text"; text: string }
  | { type: "paragraph_break" }
  | { type: "newline" };

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
    case "link":
      if (node.genre_id) {
        return (
          <span>
            <InternalLink href={`#${node.genre_id}`}>{node.text}</InternalLink>
            <sup>
              <WikipediaLink pageTitle={node.title}>wp</WikipediaLink>
            </sup>
          </span>
        );
      }
      return <WikipediaLink pageTitle={node.title}>{node.text}</WikipediaLink>;
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
    case "paragraph_break":
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
  template: Extract<WikitextNode, { type: "template" }>
) {
  return Object.fromEntries(template.children.map((c) => [c.name, c.value]));
}

function WikitextTemplate({
  node,
}: {
  node: Extract<WikitextNode, { type: "template" }>;
}) {
  const templateName = node.name
    .replace(/^template:/, "")
    .replace(/ /g, "_")
    .toLowerCase();
  switch (templateName) {
    case "nihongo":
      // TODO: consider replicating the other arguments of the template
      return <>{node.children[0].value}</>;
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
        <span className="whitespace-nowrap">{node.children[0].value}</span>
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
