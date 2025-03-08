import { WikitextSimplifiedNode } from "wikitext_simplified";
import React from "react";

import { Wikitext } from "../wikitexts/Wikitext";
import { Blockquote } from "../../Blockquote";
import { Footnote } from "../../Footnote";
import { IetfLanguageTagLink } from "../IetfLanguageTagLink";
import { Music } from "./music/Music";
import { useWikiUrl } from "../urls";
import { WikipediaMaybeGenreLink } from "../links/WikipediaMaybeGenreLink";
import { Zh } from "./Zh";

/**
 * Renders a Wikitext simplified template node, including implementations for all supported templates.
 */
export function WikitextTemplate({
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
      return <Footnote node={node.children[0].value} />;
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

      return <Music symbol={musicSymbol} param2={param2} param3={param3} />;
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
      return <Zh node={node} />;
    default:
      throw new Error(
        `Unknown template: ${wikiUrl ?? ""}/Template:${templateName}`
      );
  }
}

function templateToObject(
  template: Extract<WikitextSimplifiedNode, { type: "template" }>
) {
  return Object.fromEntries(template.children.map((c) => [c.name, c.value]));
}
