import { WikitextSimplifiedNode } from "frontend_wasm";
import React from "react";

import { useWikiUrl } from "../urls";
import { Footnote } from "../../Footnote";
import { WikipediaMaybeGenreLink } from "../links/WikipediaMaybeGenreLink";
import { Wikitext } from "../wikitexts/Wikitext";

import { Zh } from "./Zh";
import { Mongolunicode } from "./Mongolunicode";
import { Abbrlink } from "./Abbrlink";
import { Cquote } from "./Cquote";
import { Langx } from "./Langx";
import { Langnf } from "./Langnf";
import { Nihongo } from "./Nihongo";
import { IPAcEn } from "./IPAc-en";

import { Music } from "./music/Music";
import { Listen } from "./Listen";

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
      return <Nihongo node={node} />;
    case "'":
      return <>'</>;
    case `'_"`:
      return <>'"</>;
    case `-"`:
      return <>"</>;
    case "abbr":
    case "abbrlink":
      return <Abbrlink node={node} templateName={templateName} />;
    case "according_to_whom":
      return <sup>[according to whom]</sup>;
    case "anchor":
      // We don't need to emit anchors in our output
      return null;
    case "by_whom":
      return <sup>[by whom?]</sup>;
    case "quote":
    case "blockquote":
    case "cquote":
      return <Cquote node={node} />;
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
          {node.parameters[0].value} {node.parameters[1].value}
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
      return (
        <Footnote>
          <Wikitext wikitext={node.parameters[0].value} />
        </Footnote>
      );
    case "em":
      return (
        <em>
          {node.parameters.map((child, i) => (
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
    case "ill": {
      const pageTitle = node.parameters[0].value;
      return (
        <WikipediaMaybeGenreLink pageTitle={pageTitle}>
          {pageTitle}
        </WikipediaMaybeGenreLink>
      );
    }
    case "ipa": {
      const ipa =
        node.parameters.length > 1 ? node.parameters[1] : node.parameters[0];
      // TODO: render properly, preferably with language support (the optional first argument, skipped above)
      return <code>{ipa.value}</code>;
    }
    case "ipa-all":
      // As it turns out, this template was actually deleted between the dump I started working with and
      // when I started this project. Unfortunately, this means we still have to handle it.
      return <code>{node.parameters[0].value}</code>;
    case "ipac-en":
      return <IPAcEn node={node} />;
    case "irrelevant_citation":
      return <sup>[irrelevant citation]</sup>;
    case "korean":
      // TODO: support hanja/rr/etc, instead of assuming hangul
      return <span>Korean: {node.parameters[0].value}</span>;
    case "lang":
      // TODO: indicate language to browser / support rtl+italic+size
      return (
        <span>
          <Wikitext wikitext={node.parameters[1].value} />
        </span>
      );
    case "lang-rus":
      return (
        <span>
          Russian: {node.parameters[0].value}
          {node.parameters.length > 1 &&
            `, romanized: ${node.parameters[1].value}`}
        </span>
      );
    case "lang-sr-cyrl":
      return <span>Serbian Cyrillic: {node.parameters[0].value}</span>;
    case "lang-su-fonts":
    case "sund":
      return <Wikitext wikitext={node.parameters[0].value} />;
    case "langx":
      return <Langx node={node} />;
    case "language_with_name/for":
    case "langnf":
      return <Langnf node={node} />;
    case "linktext":
      // TODO: make each keyword linkable to Wikitionary
      return (
        <>
          {node.parameters
            .filter((c) => c.name !== "pref")
            .map((c) => c.value)
            .join("")}
        </>
      );
    case "listen":
      return <Listen node={node} />;
    case "lit":
    case "lit.":
    case "literal":
    case "literally":
    case "literal_translation": {
      const params = node.parameters.filter((p) => p.name !== "lk");
      return (
        <span>
          <abbr
            title="literal translation"
            className="text-sm border-b border-dotted border-gray-500 cursor-help"
          >
            lit.
          </abbr>{" "}
          {params.map((p, index) => (
            <React.Fragment key={index}>
              {index > 0 && " or "}
              '<Wikitext wikitext={p.value} />'
            </React.Fragment>
          ))}
        </span>
      );
    }
    case "mongolunicode":
      return <Mongolunicode node={node} />;
    case "multiple_image":
      // We don't render images from the description
      return null;
    case "music":
      return (
        <Music
          symbol={node.parameters[0]?.value || ""}
          param2={node.parameters[1]?.value}
          param3={node.parameters[2]?.value}
        />
      );
    case "music_genre_stub":
    case "music-genre-stub":
      // Stub notice: don't care
      return null;
    // eslint-disable-next-line no-fallthrough
    case "music_of_cape_verde":
    // Category box: don't care
    // eslint-disable-next-line no-fallthrough
    case "music_of_jamaica":
    // Category box: don't care
    // eslint-disable-next-line no-fallthrough
    case "nastaliq":
    case "script/nastaliq":
    case "nq":
      // Requesting a particular choice of fonts: not sure how to support
      return null;
    case "nbsp":
      return <>&nbsp;</>;
    case "not_a_typo":
    case "proper_name":
      return <>{node.parameters.map((c) => c.value).join("")}</>;
    case "noitalic":
      return <span className="not-italic">{node.parameters[0].value}</span>;
    case "nowrap":
      return (
        <span className="whitespace-nowrap">{node.parameters[0].value}</span>
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
    case "sfnp":
    case "#tag:ref":
      // Don't care about references
      return null;
    case "respell":
      return (
        <span className="italic">
          {node.parameters.map((c) => c.value).join("-")}
        </span>
      );
    case "sic":
      return <>[sic]</>;
    case "small":
    case "smaller":
      return (
        <small>
          {node.parameters.map((c, i) => (
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
          {node.parameters.length > 2
            ? node.parameters[2].value
            : node.parameters[1].value}
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
