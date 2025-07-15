import { WikitextSimplifiedNode } from "frontend_wasm";
import React from "react";

import { useWikiUrl } from "../urls";
import { Footnote } from "../../Footnote";
import { WikipediaMaybeGenreLink } from "../links/WikipediaMaybeGenreLink";
import { Wikitext } from "../wikitexts/Wikitext";

import { Zh } from "./Zh";
import { Mongolunicode } from "./Mongolunicode";
import { Abbrlink } from "./Abbrlink";
import { AsOf } from "./AsOf";
import { Cquote } from "./Cquote";
import { Langx } from "./Langx";
import { Langnf } from "./Langnf";
import { Nihongo } from "./Nihongo";
import { IPAcEn } from "./IPAc-en";
import { KoreanAuto } from "./KoreanAuto";
import { Fix } from "./Fix";

import { Music } from "./music/Music";
import { Listen } from "./Listen";

/**
 * Custom error class for missing templates
 */
export class MissingTemplateError extends Error {
  constructor(
    public templateName: string,
    public wikiUrl: string | undefined
  ) {
    super(`Unknown template: ${wikiUrl ?? ""}/Template:${templateName}`);
    this.name = "MissingTemplateError";
  }
}

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
    case "'":
      return <>'</>;
    case `"'`:
      return <>'"'</>;
    case `'"`:
      return <>'"'</>;
    case `'s`:
      return <>'s</>;
    case "`":
      return <>'</>;
    case `'_"`:
      return <>'"</>;
    case `-"`:
      return <>"</>;
    case "aka":
    case "also_known_as":
    case "a.k.a.":
      return <>"a.k.a."</>;
    case "abbr":
    case "abbrlink":
      return <Abbrlink node={node} templateName={templateName} />;
    case "according_to_whom":
    case "according_to_whom?":
      return <Fix>according to whom?</Fix>;
    case "anchor":
      // We don't need to emit anchors in our output
      return null;
    case "as_of":
      return <AsOf node={node} />;
    case "authority_control":
      // Don't care about this
      return null;
    case "better_source":
    case "better_source_needed":
      return <Fix>better source</Fix>;
    case "broken_anchor":
      return <Fix>broken anchor</Fix>;
    case "by_whom":
    case "by_whom?":
      return <Fix>by whom?</Fix>;
    case "cbignore":
      // Don't care about this
      return null;
    case "certification_cite_ref":
      // Don't care about this
      return null;
    case "quote":
    case "blockquote":
    case "cquote":
      return <Cquote node={node} />;
    case "chabad_(rebbes_and_chasidim)":
      // Sidebar; we don't care about this
      return null;
    case "cita_requerida":
    case "citation_needed":
    case "citesource":
    case "cn":
    case "fact":
    case "facts":
    case "source_needed":
      return <Fix>citation needed</Fix>;
    case "citation_needed_lead":
    case "not_verified_in_body":
      return <Fix>not verified in body</Fix>;
    case "cite_web":
      // Don't care about this
      return null;
    case "circa":
    case "c.":
      return <>"c."</>;
    case "clarify":
    case "clarification_needed":
      return <Fix>clarification needed</Fix>;
    case "clarify_span":
      return <Fix>clarify</Fix>;
    case "clear":
      // Not semantically meaningful
      return null;
    case "commons":
      // Don't care about this
      return null;
    case "contradiction-inline":
    case "contradictory_inline":
      return <Fix>contradiction</Fix>;
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
    case "deprecated_source":
      return <Fix>deprecated source?</Fix>;
    case "disputed":
      // Don't care about this notice
      return null;
    case "disputed_inline":
      return <Fix>disputed</Fix>;
    case "efn":
    case "efn-ua":
      return (
        <Footnote>
          <Wikitext wikitext={node.parameters[0].value} />
        </Footnote>
      );
    case "efn_portuguese_name":
      // Don't care about this
      return null;
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
    case "mdash":
      return <>—</>;
    case "en_dash":
    case "endash":
    case "ndash":
      return <>–</>;
    case "esccnty":
      return <>{node.parameters[0].value}</>;
    case "escyr":
      return <>{node.parameters[2]?.value || node.parameters[0].value}</>;
    case "failed_verification":
    case "not_in_ref":
      return <Fix>failed verification</Fix>;
    case "family_name_footnote":
      // Don't care about this
      return null;
    case "full_citation_needed":
      return <Fix>full citation needed</Fix>;
    case "hair_space":
    case "hairsp":
      return <>&hairsp;</>;
    case "iast":
      return (
        <Wikitext
          wikitext={`{{Transliteration|sa|IAST|${node.parameters[0].value}}}`}
        />
      );
    case "iast3":
      return (
        <Wikitext wikitext={`[[IAST]]: {{IAST|${node.parameters[0].value}}}`} />
      );
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
    case "ipa-cen":
      return <IPAcEn node={node} />;
    case "irrelevant_citation":
      return <Fix>irrelevant citation</Fix>;
    case "korean":
    case "ko-hhrm":
      // TODO: support hanja/rr/etc, instead of assuming hangul
      return <span>Korean: {node.parameters[0].value}</span>;
    case "korean/auto":
      return <KoreanAuto node={node} />;
    case "lang":
    case "lang-latn":
      // TODO: indicate language to browser / support rtl+italic+size
      return (
        <span>
          <Wikitext wikitext={node.parameters[1].value} />
        </span>
      );
    case "lang-ka":
      return <span>Georgian: {node.parameters[0].value}</span>;
    case "lang-rus":
      return (
        <span>
          Russian: {node.parameters[0].value}
          {node.parameters.length > 1 &&
            `, romanized: ${node.parameters[1].value}`}
        </span>
      );
    case "lang-sr-cyr":
    case "lang-sr-cyrl":
      return <span>Serbian Cyrillic: {node.parameters[0].value}</span>;
    case "lang-su-fonts":
    case "sund":
      return <Wikitext wikitext={node.parameters[0].value} />;
    case "langr":
    case "lang_unset_italics":
      return (
        <WikitextTemplate
          node={{
            type: "template",
            name: "lang",
            parameters: [...node.parameters, { name: "i", value: "unset" }],
          }}
        />
      );
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
    case "lrm":
      return <>&lrm;</>;
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
    case "ne":
    case "né":
      return <>né</>;
    case "nee":
    case "née":
      return <>née</>;
    case "nihongo":
      return <Nihongo node={node} />;
    case "nihongo2":
      return <>{node.parameters[0].value}</>;
    case "notetag":
      // Don't care about this
      return null;
    case "not_a_typo":
    case "notatypo":
    case "proper_name":
      return <>{node.parameters.map((c) => c.value).join("")}</>;
    case "noitalic":
      return (
        <span className="not-italic">
          <Wikitext wikitext={node.parameters[0].value} />
        </span>
      );
    case "nowrap":
    case "nobr":
      return (
        <span className="whitespace-nowrap">
          <Wikitext wikitext={node.parameters[0].value} />
        </span>
      );
    case "okina":
      return <>ʻ</>;
    case "original_research_inline":
      return <Fix>original research?</Fix>;
    case "page_needed":
      return <Fix>page needed</Fix>;
    case "phillippine_peso":
    case "₱":
      return <>₱{node.parameters.length > 0 ? node.parameters[0].value : ""}</>;
    case "primary_source_inline":
      return <Fix>non-primary source needed</Fix>;
    case "pronunciation":
      // TODO: implement, this could be quite important for this use case
      return null;
    case "pronunciation_needed":
    case "pronunciation?":
    case "pron":
      return <Fix>pronunciation?</Fix>;
    case "r":
    case "ref label":
    case "ref_label":
    case "refn":
    case "rp":
    case "sfn":
    case "sfnp":
    case "snf":
    case "#tag:ref":
      // Don't care about references
      return null;
    case "rembetika":
      // Category box: don't care
      return null;
    case "respell":
      return (
        <span className="italic">
          {node.parameters.map((c) => c.value).join("-")}
        </span>
      );
    case "rock-band-stub":
      // Stub notice: don't care
      return null;
    case "ruby": {
      const lower = node.parameters[0].value;
      const upper = node.parameters[1].value;
      return (
        <ruby>
          {lower}
          <rp>(</rp>
          <rt>{upper}</rt>
          <rp>)</rp>
        </ruby>
      );
    }
    case "sans-serif":
      return <Wikitext wikitext={node.parameters[0].value} />;
    case "self-published_inline":
    case "sps":
      return <Fix>self-published source?</Fix>;
    case "short_description":
      // Don't care about this
      return null;
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
    case "spaced_en_dash":
    case "snd":
    case "spaced_ndash":
    case "spnd":
      return <>&nbsp;&ndash; </>;
    case "spaced_en_dash_space":
    case "snds":
      return <>&nbsp;&ndash;&nbsp;</>;
    case "sup":
      return (
        <sup>
          <Wikitext wikitext={node.parameters[0].value} />
        </sup>
      );
    case "sources_exist":
      // Don't care about this notice
      return null;
    case "technical_inline":
      return <Fix>jargon</Fix>;
    case "text-source_inline":
      return <Fix>text–source integrity?</Fix>;
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
    case "two_pixel_space":
    case "px2":
      return (
        <span
          style={{
            visibility: "hidden",
            color: "transparent",
            paddingLeft: "2px",
          }}
        >
          &zwj;
        </span>
      );
    case "update_inline":
      return <Fix>needs update</Fix>;
    case "unreliable_source":
    case "unreliable_source?":
    case "unreliable_source_inline":
      return <Fix>unreliable source?</Fix>;
    case "us$":
    case "us_dollar":
      return <>${node.parameters[0].value}</>;
    case "use_dmy_dates":
    case "use_indian_english":
      // Don't care about these notices
      return null;
    case "verification_needed":
      return <Fix>verification needed</Fix>;
    case "what":
    case "what?":
      return <Fix>what?</Fix>;
    case "when":
    case "when?":
      return <Fix>when?</Fix>;
    case "which":
    case "which?":
      return <Fix>which?</Fix>;
    case "who":
    case "who?":
      return <Fix>who?</Fix>;
    case "wikibooks":
      // Book links not relevant to a description
      return null;
    case "lang-zh":
    case "zh":
      return <Zh node={node} />;
    default:
      throw new MissingTemplateError(templateName, wikiUrl ?? undefined);
  }
}
