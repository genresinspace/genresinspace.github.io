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

/**
 * Constructs the base Wikipedia URL for a given domain
 * @param domain - The Wikipedia domain (e.g. "en.wikipedia.org")
 * @returns The base Wikipedia URL (e.g. "https://en.wikipedia.org/wiki")
 */
export function wikiUrl(domain: string): string {
  return `https://${domain}/wiki`;
}

/**
 * Constructs the full Wikipedia page URL from a base wiki URL and page title
 * @param wikiUrl - The base Wikipedia URL (e.g. "https://en.wikipedia.org/wiki")
 * @param pageTitle - The title of the Wikipedia page
 * @returns The full Wikipedia page URL with spaces replaced by underscores
 */
export function wikiPageUrl(wikiUrl: string, pageTitle: string): string {
  return `${wikiUrl}/${pageTitle.replace(/ /g, "_")}`;
}

/**
 * React hook that returns the base Wikipedia URL using the domain from context
 * @returns The base Wikipedia URL or null if no domain is found in context
 */
export const useWikiUrl = () => {
  const meta = useContext(WikipediaMetaContext);
  if (!meta) {
    return null;
  }
  return wikiUrl(meta.domain);
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

  return <ExternalLink {...rest} href={wikiPageUrl(wikiUrl, pageTitle)} />;
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
        return (node.text ?? node.link).length;
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

function templateToObject(
  template: Extract<WikitextSimplifiedNode, { type: "template" }>
) {
  return Object.fromEntries(template.children.map((c) => [c.name, c.value]));
}

/**
 * Component for rendering time signatures
 */
function TimeSignature({
  numerator,
  denominator,
}: {
  numerator: string;
  denominator: string;
}) {
  return (
    <span className="inline-flex flex-col items-center justify-center leading-tight text-xs align-middle">
      <span className="text-center leading-none">{numerator}</span>
      <span className="text-center leading-none">{denominator}</span>
    </span>
  );
}

/**
 * Component for rendering music notation symbols using Unicode where available
 */
function MusicSymbol({
  symbol,
  param2,
  param3,
}: {
  symbol: string;
  param2?: string;
  param3?: string;
}) {
  // Convert symbol to lowercase for case-insensitive matching
  const lowerSymbol = symbol.toLowerCase();

  // Handle chord notation with superscript/subscript
  const renderChordNotation = (notation: string) => {
    if (notation === "6") return <sup>6</sup>;
    if (notation === "7 chord") return <sup>7</sup>;
    if (notation === "2" || notation === "2 chord") return <sup>2</sup>;

    // Handle complex notations with both superscript and subscript
    if (notation === "64" || notation === "64 chord")
      return (
        <span>
          <sup>6</sup>
          <sub>4</sub>
        </span>
      );
    if (notation === "63" || notation === "63 chord")
      return (
        <span>
          <sup>6</sup>
          <sub>3</sub>
        </span>
      );
    if (notation === "53" || notation === "53 chord")
      return (
        <span>
          <sup>5</sup>
          <sub>3</sub>
        </span>
      );
    if (notation === "65" || notation === "65 chord")
      return (
        <span>
          <sup>6</sup>
          <sub>5</sub>
        </span>
      );
    if (notation === "43 chord")
      return (
        <span>
          <sup>4</sup>
          <sub>3</sub>
        </span>
      );
    if (notation === "42" || notation === "42 chord")
      return (
        <span>
          <sup>4</sup>
          <sub>2</sub>
        </span>
      );
    if (notation === "07 chord")
      return (
        <span>
          <sup>0</sup>
          <sub>7</sub>
        </span>
      );
    if (notation === "75" || notation === "75 chord")
      return (
        <span>
          <sup>7</sup>
          <sub>5</sub>
        </span>
      );

    // More complex notations could be handled here
    return <span>{notation}</span>;
  };

  switch (lowerSymbol) {
    // Accidentals
    case "♭":
    case "b":
    case "flat":
      return <span className="music-flat">♭</span>;
    case "𝄫":
    case "bb":
    case "double flat":
    case "doubleflat":
      return <span>𝄫</span>;
    case "bbb":
    case "triple flat":
    case "tripleflat":
      return <span>♭♭♭</span>; // Fallback for triple flat
    case "d":
    case "half flat":
    case "halfflat":
      return <span>𝄳</span>; // Using closest Unicode symbol
    case "♮":
    case "n":
    case "natural":
      return <span className="music-natural">♮</span>;
    case "♯":
    case "#":
    case "sharp":
      return <span className="music-sharp">♯</span>;
    case "𝄪":
    case "x":
    case "##":
    case "double sharp":
    case "doublesharp":
      return <span>𝄪</span>;
    case "###":
    case "#x":
    case "x#":
    case "triple sharp":
    case "triplesharp":
      return <span>♯♯♯</span>; // Fallback for triple sharp
    case "t":
    case "half sharp":
    case "halfsharp":
      return <span>𝄲</span>; // Using closest Unicode symbol

    // Note values
    case "doublewholenote":
    case "double whole note":
    case "doublenote":
    case "double note":
    case "breve":
      return <span>𝅜</span>;
    case "wholenote":
    case "whole note":
    case "whole":
    case "semibreve":
      return <span>𝅝</span>;
    case "halfnote":
    case "half note":
    case "half":
    case "minim":
      return <span>𝅗𝅥</span>;
    case "quarternote":
    case "quarter note":
    case "quarter":
    case "crotchet":
      return <span>𝅘𝅥</span>;
    case "eighthnote":
    case "eighth note":
    case "eighth":
    case "quaver":
      return <span>𝅘𝅥𝅮</span>;
    case "eighthnotebeam":
    case "eighth note beam":
    case "eighthbeam":
    case "eighth beam":
    case "quaverbeam":
    case "quaver beam":
      return <span>𝅘𝅥𝅮𝅘𝅥𝅮</span>;
    case "sixteenthnote":
    case "sixteenth note":
    case "sixteenth":
    case "semiquaver":
      return <span>𝅘𝅥𝅯</span>;
    case "thirtysecondnote":
    case "thirtysecond note":
    case "thirty-secondnote":
    case "thirty-second note":
    case "thirtysecond":
    case "thirty-second":
    case "32nd":
    case "32nd note":
    case "demisemiquaver":
      return <span>𝅘𝅥𝅰</span>;
    case "sixtyfourthnote":
    case "sixtyfourth note":
    case "sixty-fourthnote":
    case "sixty-fourth note":
    case "sixtyfourth":
    case "sixty-fourth":
    case "64th":
    case "64th note":
    case "hemidemisemiquaver":
      return <span>𝅘𝅥𝅱</span>;

    // Dotted notes
    case "dottedquarter":
    case "dotted quarter":
    case "dottedcrotchet":
    case "dotted crotchet":
      return <span>𝅘𝅥.</span>;
    case "dottedhalf":
    case "dotted half":
    case "dottedminim":
    case "dotted minim":
      return <span>𝅗𝅥.</span>;

    // Rests
    case "wholerest":
    case "whole rest":
    case "semibreverest":
    case "semibreve rest":
      return <span>𝄻</span>;
    case "halfrest":
    case "half rest":
    case "minimrest":
    case "minim rest":
      return <span>𝄼</span>;
    case "quarterrest":
    case "quarter rest":
    case "crotchet rest":
    case "crotchetrest":
      return <span>𝄽</span>;
    case "eighthrest":
    case "eighth rest":
    case "quaver rest":
    case "quaverrest":
      return <span>𝄾</span>;
    case "sixteenthrest":
    case "sixteenth rest":
    case "semiquaver rest":
    case "semiquaverrest":
      return <span>𝄿</span>;
    case "thirtysecondrest":
    case "thirtysecond rest":
    case "thirty-secondrest":
    case "thirty-second rest":
    case "32nd rest":
    case "demisemiquaver rest":
    case "demisemiquaverrest":
      return <span>𝅀</span>;
    case "sixtyfourthrest":
    case "sixtyfourth rest":
    case "sixty-fourthrest":
    case "sixty-fourth rest":
    case "64th rest":
    case "hemidemisemiquaver rest":
    case "hemidemisemiquaverrest":
      return <span>𝅁</span>;

    // Clefs
    case "treble":
    case "treble clef":
    case "trebleclef":
    case "g clef":
    case "gclef":
      return <span>𝄞</span>;
    case "bass":
    case "bass clef":
    case "bassclef":
    case "f clef":
    case "fclef":
      return <span>𝄢</span>;
    case "alto":
    case "alto clef":
    case "altoclef":
    case "tenor":
    case "tenor clef":
    case "tenorclef":
    case "c clef":
    case "cclef":
      return <span>𝄡</span>;
    case "neutral":
    case "neutralclef":
    case "neutral clef":
      return <span>||</span>;

    // Time signatures
    case "common":
    case "commontime":
    case "common-time":
      return <span>𝄴</span>;
    case "alla-breve":
    case "allabreve":
    case "cut":
    case "cuttime":
    case "cut-time":
      return <span>𝄵</span>;
    case "time":
    case "timesig":
    case "time sig":
    case "timesignature":
    case "time signature":
      return (
        <TimeSignature numerator={param2 || "4"} denominator={param3 || "4"} />
      );

    // Chord symbols
    case "°":
    case "diminished":
    case "dim":
      return <sup>o</sup>;
    case "dimdeg":
      return <>°</>;
    case "ø":
    case "halfdim":
    case "half dim":
    case "halfdiminished":
    case "half diminished":
    case "dimslash":
      return <sup>ø</sup>;
    case "aug":
    case "augmented":
      return <sup>+</sup>;
    case "maj":
    case "major":
    case "delta":
    case "δ":
      return <span>Δ</span>;

    // Numeric chord symbols
    case "6":
    case "64":
    case "63":
    case "6 chord":
    case "53":
    case "53 chord":
    case "7 chord":
    case "65":
    case "65 chord":
    case "43 chord":
    case "2":
    case "2 chord":
    case "42":
    case "42 chord":
    case "07 chord":
    case "75":
    case "75 chord":
    case "643":
    case "643 chord":
    case "642":
    case "642 chord":
      return renderChordNotation(lowerSymbol);

    // Special characters
    case "em_dash":
    case "emdash":
      return <>—</>;
    case "en_dash":
    case "endash":
    case "ndash":
      return <>–</>;
    case "snd":
      return <> – </>;
    case "dot":
      return <>.</>;
    case "nbsp":
      return <>&nbsp;</>;

    // Plus/minus
    case "+":
    case "plus":
      return <>+</>;
    case "-":
    case "minus":
      return <>-</>;

    // Repeat signs
    case "left repeat":
    case "leftrepeat":
      return <span>𝄆</span>;
    case "repeat":
    case "right repeat":
    case "rightrepeat":
      return <span>𝄇</span>;

    // Key signatures - simplified representation
    case "c major":
    case "a minor":
      return <span title="C major / A minor">♮</span>;
    case "g major":
    case "e minor":
      return <span title="G major / E minor">♯</span>;
    case "f major":
    case "d minor":
      return <span title="F major / D minor">♭</span>;

    // Editorial markings
    case "sic":
      return <>[sic]</>;

    // Septimal notation and microtonal symbols
    case "septimal minus":
    case "7":
      return <span>7↓</span>;
    case "l":
    case "ㄥ":
    case "7u":
    case "u7":
    case "septimal plus":
      return <span>7↑</span>;
    case "11":
    case "11 up":
    case "11 plus":
      return <span>11↑</span>;
    case "11 minus":
    case "11 down":
    case "11u":
    case "u11":
      return <span>11↓</span>;
    case "up":
      return <>↑</>;
    case "down":
      return <>↓</>;

    // Default case for unrecognized symbols
    default:
      // If this appears to be a key signature format but not handled above
      if (lowerSymbol.includes("major") || lowerSymbol.includes("minor")) {
        return <span>{symbol.replace(/-/g, " ")}</span>;
      }

      return <span title={`Music symbol: ${symbol}`}>♪</span>; // Musical note symbol as fallback
  }
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
    case "langx": {
      // TODO: support transliteration / translation
      const params = templateToObject(node);
      const tag = params.code || params["1"];
      const text = params.text || params["2"];
      const label = params.label;
      return (
        <>
          {label !== "none" && (
            <>
              <IetfLanguageTagLink tag={tag} label={label} />:{" "}
            </>
          )}
          <Wikitext wikitext={text} />
        </>
      );
    }
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
      // Extract all possible parameters
      const musicSymbol = node.children[0]?.value || "";
      const param2 = node.children[1]?.value;
      const param3 = node.children[2]?.value;

      return (
        <MusicSymbol symbol={musicSymbol} param2={param2} param3={param3} />
      );
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
    case "small":
    case "smaller":
      return (
        <small>
          {node.children.map((c, i) => (
            <Wikitext key={i} wikitext={c.value} />
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
    case "who?":
      return <sup>[who?]</sup>;
    case "wikibooks":
      // Book links not relevant to a description
      return null;
    case "lang-zh":
    case "zh":
      const texts = node.children
        .filter((c) => c.value.length > 0)
        .map((c, i) => {
          let label;
          let prefix = "";
          let suffix = "";
          switch (c.name) {
            case "t":
              label = "traditional Chinese";
              break;
            case "s":
              label = "simplified Chinese";
              break;
            case "c":
              label = "Chinese";
              break;
            case "p":
              label = "pinyin";
              break;
            case "tp":
              label = "Tongyong Pinyin";
              break;
            case "w":
              label = "Wade–Giles";
              break;
            case "j":
              label = "Jyutping";
              break;
            case "cy":
              label = "Cantonese Yale";
              break;
            case "sl":
              label = "Sidney Lau";
              break;
            case "poj":
              label = "Pe̍h-ōe-jī";
              break;
            case "tl":
              label = "Tâi-lô";
              break;
            case "zhu":
              label = "Zhuyin Fuhao";
              break;
            case "l":
              prefix = "lit. '";
              suffix = "'";
              break;
            case "tr":
              prefix = 'trans. "';
              suffix = '"';
              break;
            default:
              return null;
          }
          return (
            <React.Fragment key={i}>
              {label && <>{label}: </>}
              {prefix}
              <Wikitext wikitext={c.value} />
              {suffix}
            </React.Fragment>
          );
        })
        .filter((t) => t !== null)
        .reduce((prev, curr, i) => (
          <React.Fragment key={i}>
            {prev}
            {i > 0 && "; "}
            {curr}
          </React.Fragment>
        ));
      return <span>{texts}</span>;
    default:
      throw new Error(
        `Unknown template: ${wikiUrl ?? ""}/Template:${templateName}`
      );
  }
}

function IetfLanguageTagLink({ tag, label }: { tag: string; label?: string }) {
  // Produced from the Wikipedia article on IETF language tags, plus whatever ones were required to
  // render the rest of the articles. Would be nice to use the canonical list, but I don't see an
  // easy way to get at the Lua backing `langx`.
  const languageLinks: Record<string, { pageTitle: string; name?: string }> = {
    af: { pageTitle: "Afrikaans" },
    am: { pageTitle: "Amharic" },
    ar: { pageTitle: "Arabic" },
    arn: { pageTitle: "Mapuche language", name: "Mapudungun" },
    ary: { pageTitle: "Moroccan Arabic" },
    arz: { pageTitle: "Egyptian Arabic language", name: "Egyptian Arabic" },
    as: { pageTitle: "Assamese language", name: "Assamese" },
    az: { pageTitle: "Azerbaijani language", name: "Azerbaijani" },
    ba: { pageTitle: "Bashkir language", name: "Bashkir" },
    ban: { pageTitle: "Balinese language", name: "Balinese" },
    be: { pageTitle: "Belarusian language", name: "Belarusian" },
    ber: { pageTitle: "Berber languages" },
    bg: { pageTitle: "Bulgarian language", name: "Bulgarian" },
    bn: { pageTitle: "Bengali language", name: "Bengali" },
    bo: { pageTitle: "Tibetan language (standard)", name: "Tibetan" },
    br: { pageTitle: "Breton language", name: "Breton" },
    bs: { pageTitle: "Bosnian language", name: "Bosnian" },
    ca: { pageTitle: "Catalan language", name: "Catalan" },
    ckb: { pageTitle: "Sorani", name: "Central Kurdish" },
    co: { pageTitle: "Corsican language", name: "Corsican" },
    cs: { pageTitle: "Czech language", name: "Czech" },
    cy: { pageTitle: "Welsh language", name: "Welsh" },
    da: { pageTitle: "Danish language", name: "Danish" },
    de: { pageTitle: "German language", name: "German" },
    dsb: { pageTitle: "Lower Sorbian language", name: "Lower Sorbian" },
    dv: { pageTitle: "Divehi (language)", name: "Divehi" },
    el: { pageTitle: "Greek language", name: "Greek" },
    en: { pageTitle: "English language", name: "English" },
    es: { pageTitle: "Spanish language", name: "Spanish" },
    et: { pageTitle: "Estonian language", name: "Estonian" },
    eu: { pageTitle: "Basque language", name: "Basque" },
    fa: { pageTitle: "Persian language", name: "Persian" },
    fi: { pageTitle: "Finnish language", name: "Finnish" },
    fil: { pageTitle: "Filipino language", name: "Filipino" },
    fo: { pageTitle: "Faroese language", name: "Faroese" },
    fr: { pageTitle: "French language", name: "French" },
    fy: { pageTitle: "Frisian languages", name: "Frisian" },
    ga: { pageTitle: "Irish language", name: "Irish" },
    gcf: {
      pageTitle: "Guadeloupean Creole French language",
      name: "Guadeloupean Creole French",
    },
    gd: { pageTitle: "Scottish Gaelic" },
    gil: { pageTitle: "Gilbertese language", name: "Gilbertese" },
    gl: { pageTitle: "Galician language", name: "Galician" },
    gsw: { pageTitle: "Swiss German" },
    gu: { pageTitle: "Gujarati language", name: "Gujarati" },
    ha: { pageTitle: "Hausa language", name: "Hausa" },
    he: { pageTitle: "Hebrew language", name: "Hebrew" },
    hi: { pageTitle: "Hindi" },
    ht: { pageTitle: "Haitian Creole language", name: "Haitian Creole" },
    hr: { pageTitle: "Croatian language", name: "Croatian" },
    hsb: { pageTitle: "Upper Sorbian language", name: "Upper Sorbian" },
    hu: { pageTitle: "Hungarian language", name: "Hungarian" },
    hy: { pageTitle: "Armenian language", name: "Armenian" },
    id: { pageTitle: "Indonesian language", name: "Indonesian" },
    ig: { pageTitle: "Igbo language", name: "Igbo" },
    ii: { pageTitle: "Nuosu language", name: "Yi" },
    is: { pageTitle: "Icelandic language", name: "Icelandic" },
    it: { pageTitle: "Italian language", name: "Italian" },
    iu: { pageTitle: "Inuktitut" },
    ja: { pageTitle: "Japanese language", name: "Japanese" },
    jam: { pageTitle: "Jamaican Patois language", name: "Jamaican Patois" },
    jv: { pageTitle: "Javanese language", name: "Javanese" },
    ka: { pageTitle: "Georgian language", name: "Georgian" },
    kea: { pageTitle: "Kabuverdianu language", name: "Kabuverdianu" },
    kk: { pageTitle: "Kazakh language", name: "Kazakh" },
    kl: { pageTitle: "Greenlandic language", name: "Greenlandic" },
    km: { pageTitle: "Khmer language", name: "Khmer" },
    kn: { pageTitle: "Kannada" },
    ko: { pageTitle: "Korean language", name: "Korean" },
    kok: { pageTitle: "Konkani language", name: "Konkani" },
    ku: { pageTitle: "Kurdish language", name: "Kurdish" },
    ky: { pageTitle: "Kyrgyz language", name: "Kyrgyz" },
    lb: { pageTitle: "Luxembourgish" },
    lo: { pageTitle: "Lao language", name: "Lao" },
    lt: { pageTitle: "Lithuanian language", name: "Lithuanian" },
    lv: { pageTitle: "Latvian language", name: "Latvian" },
    mfe: { pageTitle: "Morisyen language", name: "Morisyen" },
    mi: { pageTitle: "Māori language", name: "Maori" },
    mk: { pageTitle: "Macedonian language", name: "Macedonian" },
    ml: { pageTitle: "Malayalam" },
    mn: { pageTitle: "Mongolian language", name: "Mongolian" },
    moh: { pageTitle: "Mohawk language", name: "Mohawk" },
    mr: { pageTitle: "Marathi language", name: "Marathi" },
    ms: { pageTitle: "Malay language", name: "Malay" },
    mt: { pageTitle: "Maltese language", name: "Maltese" },
    my: { pageTitle: "Burmese language", name: "Burmese" },
    nb: { pageTitle: "Bokmål", name: "Norwegian (Bokmål)" },
    ne: { pageTitle: "Nepali language", name: "Nepali" },
    nl: { pageTitle: "Dutch language", name: "Dutch" },
    nn: { pageTitle: "Nynorsk", name: "Norwegian (Nynorsk)" },
    no: { pageTitle: "Norwegian language", name: "Norwegian" },
    oc: { pageTitle: "Occitan language", name: "Occitan" },
    or: { pageTitle: "Odia language", name: "Odia" },
    pa: { pageTitle: "Punjabi language", name: "Punjabi" },
    pap: { pageTitle: "Papiamento language", name: "Papiamento" },
    pi: { pageTitle: "Pali language", name: "Pali" },
    pl: { pageTitle: "Polish language", name: "Polish" },
    prs: { pageTitle: "Dari" },
    ps: { pageTitle: "Pashto" },
    pt: { pageTitle: "Portuguese language", name: "Portuguese" },
    quc: { pageTitle: "Kʼicheʼ language", name: "K'iche" },
    qu: { pageTitle: "Quechuan languages", name: "Quechua" },
    rm: { pageTitle: "Romansh language", name: "Romansh" },
    ro: { pageTitle: "Romanian language", name: "Romanian" },
    ru: { pageTitle: "Russian language", name: "Russian" },
    rw: { pageTitle: "Kinyarwanda" },
    sa: { pageTitle: "Sanskrit" },
    sah: { pageTitle: "Yakut language", name: "Yakut" },
    sc: { pageTitle: "Sardinian language", name: "Sardinian" },
    se: { pageTitle: "Northern Sami", name: "Sami (Northern)" },
    si: { pageTitle: "Sinhala language", name: "Sinhala" },
    sk: { pageTitle: "Slovak language", name: "Slovak" },
    sl: { pageTitle: "Slovene language", name: "Slovenian" },
    sma: { pageTitle: "Southern Sámi", name: "Sami (Southern)" },
    smj: { pageTitle: "Lule Sami", name: "Sami (Lule)" },
    smn: { pageTitle: "Inari Sámi language", name: "Sami (Inari)" },
    sms: { pageTitle: "Skolt Sami", name: "Sami (Skolt)" },
    sq: { pageTitle: "Albanian language", name: "Albanian" },
    sr: { pageTitle: "Serbian language", name: "Serbian" },
    st: { pageTitle: "Sotho language", name: "Sesotho" },
    su: { pageTitle: "Sundanese language", name: "Sundanese" },
    sv: { pageTitle: "Swedish language", name: "Swedish" },
    sw: { pageTitle: "Swahili language", name: "Kiswahili" },
    syc: { pageTitle: "Syriac language", name: "Syriac" },
    ta: { pageTitle: "Tamil language", name: "Tamil" },
    te: { pageTitle: "Telugu language", name: "Telugu" },
    tg: { pageTitle: "Tajik language", name: "Tajik" },
    th: { pageTitle: "Thai language", name: "Thai" },
    tk: { pageTitle: "Turkmen language", name: "Turkmen" },
    tn: { pageTitle: "Tswana language", name: "Tswana" },
    tr: { pageTitle: "Turkish language", name: "Turkish" },
    tt: { pageTitle: "Tatar language", name: "Tatar" },
    tzm: { pageTitle: "Berber languages", name: "Tamazight" },
    ug: { pageTitle: "Uyghur language", name: "Uyghur" },
    uk: { pageTitle: "Ukrainian language", name: "Ukrainian" },
    ur: { pageTitle: "Urdu" },
    uz: { pageTitle: "Uzbek language", name: "Uzbek" },
    vi: { pageTitle: "Vietnamese language", name: "Vietnamese" },
    wo: { pageTitle: "Wolof language", name: "Wolof" },
    xh: { pageTitle: "Xhosa language", name: "Xhosa" },
    yi: { pageTitle: "Yiddish language", name: "Yiddish" },
    yo: { pageTitle: "Yoruba language", name: "Yoruba" },
    zh: { pageTitle: "Chinese language", name: "Chinese" },
    zu: { pageTitle: "Zulu language", name: "Zulu" },
  };

  const link = languageLinks[tag];
  if (!link) throw new Error(`Unknown language tag: ${tag}`);

  return (
    <WikipediaLink pageTitle={link.pageTitle}>
      <Wikitext wikitext={label ?? link.name ?? link.pageTitle} />
    </WikipediaLink>
  );
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
