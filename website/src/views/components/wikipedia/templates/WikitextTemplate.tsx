import { WikitextSimplifiedNode } from "frontend_wasm";
import React from "react";

import { useWikiUrl } from "../urls";
import { Footnote } from "../../Footnote";
import { Wikitext } from "../wikitexts/Wikitext";
import { colourStyles } from "../../../colours";

import { Zh } from "./Zh";
import { Mongolunicode } from "./Mongolunicode";
import { Abbrlink } from "./Abbrlink";
import { Age } from "./Age";
import { AsOf } from "./AsOf";
import { Audio } from "./Audio";
import { Cquote } from "./Cquote";
import { Langx } from "./Langx";
import { Langnf } from "./Langnf";
import { Nihongo } from "./Nihongo";
import { IPAcEn } from "./IPAc-en";
import { KoreanAuto } from "./KoreanAuto";
import { Fix } from "./Fix";
import { PostNominals } from "./PostNominals";
import { BirthBasedOnAgeAsOfDate } from "./BirthBasedOnAgeAsOfDate";
import { BirthDate } from "./BirthDate";
import { Etymology } from "./Etymology";
import { StartDate } from "./StartDate";
import { WiktLang } from "./WiktLang";
import { TimeAgo } from "./TimeAgo";

import { Music } from "./music/Music";
import { Listen } from "./Listen";
import { WikipediaLink } from "../links/WikipediaLink";
import { InterlanguageLink } from "./InterlanguageLink";
import { Height } from "./Height";
import { templateToObject } from "./util";

// ---------------------------------------------------------------------------
// Dispatch table types and helpers
// ---------------------------------------------------------------------------

type TemplateNode = Extract<WikitextSimplifiedNode, { type: "template" }>;

interface TemplateHandler {
  render: (node: TemplateNode) => React.ReactNode;
  estimateLength: (node: TemplateNode) => number;
}

/** Template renders nothing. */
function hidden(): TemplateHandler {
  return { render: () => null, estimateLength: () => 0 };
}

/** Template renders a fixed string. */
function fixed(text: string): TemplateHandler {
  return {
    render: () => <>{text}</>,
    estimateLength: () => text.length,
  };
}

/** Template renders as a superscript [label] annotation. */
function fix(label: string): TemplateHandler {
  return {
    render: () => <Fix>{label}</Fix>,
    estimateLength: () => label.length + 2,
  };
}

// ---------------------------------------------------------------------------
// Canonical handlers — the authoritative definition for each template
// ---------------------------------------------------------------------------

const canonicalHandlers = {
  // -- Hidden (renders nothing) ---------------------------------------------
  anchor: hidden(),
  authority_control: hidden(),
  cbignore: hidden(),
  certification_cite_ref: hidden(),
  "chabad_(rebbes_and_chasidim)": hidden(),
  cite_web: hidden(),
  clear: hidden(),
  commons: hidden(),
  disputed: hidden(),
  efn_portuguese_name: hidden(),
  external_media: hidden(),
  family_name_footnote: hidden(),
  "greece-singer-stub": hidden(),
  igbo_topics: hidden(),
  inflation: hidden(),
  multiple_image: hidden(),
  music_genre_stub: hidden(),
  music_of_cape_verde: hidden(),
  nastaliq: hidden(),
  notetag: hidden(),
  out_of_date: hidden(),
  pronunciation: hidden(),
  psychedelic_sidebar: hidden(),
  r: hidden(),
  ref_label: hidden(),
  reference_page: hidden(),
  refn: hidden(),
  rp: hidden(),
  sfn: hidden(),
  "#tag:ref": hidden(),
  rembetika: hidden(),
  "rock-band-stub": hidden(),
  short_description: hidden(),
  sources_exist: hidden(),
  toc_limit: hidden(),
  use_dmy_dates: hidden(),
  webarchive: hidden(),
  wikibooks: hidden(),
  culture_of_colombia: hidden(),
  culture_of_south_africa: hidden(),

  // -- Fixed text -----------------------------------------------------------
  "'": fixed("\u2019"),
  "\"'": fixed("\u2018\u201C"),
  "'\"": fixed("\u2019\u201D"),
  "'s": fixed("\u2019s"),
  "`": fixed("\u2018"),
  "'_\"": fixed("\u2019\u201D"),
  '-"': fixed("\u201D"),
  aka: fixed("a.k.a."),
  circa: fixed("c."),
  em_dash: fixed("\u2014"),
  en_dash: fixed("\u2013"),
  currentyear: {
    render: () => <>{new Date().getFullYear()}</>,
    estimateLength: () => 4,
  },
  currentmonthname: {
    render: () => <>{new Date().toLocaleString("en-US", { month: "long" })}</>,
    estimateLength: () => 8,
  },
  hair_space: fixed("\u200A"),
  lrm: fixed("\u200E"),
  nbsp: fixed("\u00A0"),
  "n\u00E9": fixed("n\u00E9"),
  nee: fixed("n\u00E9e"),
  "n\u00E9e": fixed("n\u00E9e"),
  okina: fixed("\u02BB"),
  shy: fixed("\u00AD"),
  sic: fixed("[sic]"),
  singular: fixed("sg."),
  spaced_en_dash: fixed("\u00A0\u2013 "),
  spaced_en_dash_space: fixed("\u00A0\u2013\u00A0"),
  "inflation/year": fixed("year not available"),
  translation: fixed("transl."),
  "single+space": {
    render: () => <span style={{ paddingRight: "0.15em" }}>&#39;</span>,
    estimateLength: () => 1,
  },
  "space+double": {
    render: () => <span style={{ paddingLeft: "0.15em" }}>&quot;</span>,
    estimateLength: () => 1,
  },
  two_pixel_space: {
    render: () => (
      <span
        style={{
          visibility: "hidden",
          color: "transparent",
          paddingLeft: "2px",
        }}
      >
        &zwj;
      </span>
    ),
    estimateLength: () => 0,
  },

  // -- Fix annotations (superscript [label]) --------------------------------
  "ai-retrieved_source": fix("AI-retrieved source"),
  according_to_whom: fix("according to whom?"),
  better_source: fix("better source"),
  broken_anchor: fix("broken anchor"),
  by_whom: fix("by whom?"),
  citation_needed: fix("citation needed"),
  citation_needed_lead: fix("not verified in body"),
  clarify: fix("clarification needed"),
  clarify_span: fix("clarify"),
  "contradiction-inline": fix("contradiction"),
  dead_link: fix("dead link"),
  deprecated_source: fix("deprecated source?"),
  disambiguation_needed: fix("disambiguation needed"),
  disputed_inline: fix("disputed"),
  dubious: fix("dubious"),
  excessive_citations_inline: fix("excessive citations"),
  failed_verification: fix("failed verification"),
  full_citation_needed: fix("full citation needed"),
  irrelevant_citation: fix("irrelevant citation"),
  new_archival_link_needed: fix("new archival link needed"),
  original_research_inline: fix("original research?"),
  page_needed: fix("page needed"),
  peacock_inline: fix("peacock prose"),
  primary_source_inline: fix("non-primary source needed"),
  pronunciation_needed: fix("pronunciation?"),
  "self-published_inline": fix("self-published source?"),
  source: fix("citation needed"),
  technical_inline: fix("jargon"),
  "text-source_inline": fix("text\u2013source integrity?"),
  update_inline: fix("needs update"),
  unreliable_source: fix("unreliable source?"),
  verification_needed: fix("verification needed"),
  what: fix("what?"),
  when: fix("when?"),
  which: fix("which?"),
  where: fix("where?"),
  who: fix("who?"),

  // -- Component-based templates --------------------------------------------
  abbr: {
    render: (node: TemplateNode) => (
      <Abbrlink node={node} templateName="abbr" />
    ),
    estimateLength: (node: TemplateNode) =>
      node.parameters[0]?.value.length ?? 0,
  },
  abbrlink: {
    render: (node: TemplateNode) => (
      <Abbrlink node={node} templateName="abbrlink" />
    ),
    estimateLength: (node: TemplateNode) =>
      node.parameters[0]?.value.length ?? 0,
  },
  age: {
    render: (node: TemplateNode) => <Age node={node} />,
    estimateLength: () => 4,
  },
  audio: {
    render: (node: TemplateNode) => <Audio node={node} />,
    estimateLength: (node: TemplateNode) =>
      (node.parameters[1]?.value ?? "audio").length + 4,
  },
  as_of: {
    render: (node: TemplateNode) => <AsOf node={node} />,
    estimateLength: (node: TemplateNode) =>
      node.parameters[0]?.value.length ?? 10,
  },
  birth_date: {
    render: (node: TemplateNode) => <BirthDate node={node} />,
    estimateLength: () => 20,
  },
  birth_based_on_age_as_of_date: {
    render: (node: TemplateNode) => <BirthBasedOnAgeAsOfDate node={node} />,
    estimateLength: () => 20,
  },
  bracket: {
    render: (node: TemplateNode) => {
      if (!node.parameters || node.parameters.length === 0) return <>[</>;
      return (
        <>
          [<Wikitext wikitext={node.parameters[0].value} />]
        </>
      );
    },
    estimateLength: (node: TemplateNode) =>
      (node.parameters[0]?.value.length ?? 0) + 2,
  },
  quote: {
    render: (node: TemplateNode) => <Cquote node={node} />,
    estimateLength: (node: TemplateNode) =>
      node.parameters[0]?.value.length ?? 0,
  },
  convert: {
    render: (node: TemplateNode) => (
      <>
        {node.parameters[0].value} {node.parameters[1].value}
      </>
    ),
    estimateLength: (node: TemplateNode) =>
      (node.parameters[0]?.value.length ?? 0) +
      (node.parameters[1]?.value.length ?? 0) +
      1,
  },
  cyrl: {
    render: (node: TemplateNode) => <>Cyrillic: {node.parameters[0].value}</>,
    estimateLength: (node: TemplateNode) =>
      10 + (node.parameters[0]?.value.length ?? 0),
  },
  date2: {
    render: (node: TemplateNode) => (
      <>
        {node.parameters.map((p, i) => (
          <React.Fragment key={i}>
            {i > 0 && " "}
            <Wikitext wikitext={p.value} />
          </React.Fragment>
        ))}
      </>
    ),
    estimateLength: (node: TemplateNode) =>
      node.parameters
        .map((p) => p.value.length)
        .reduce((a, b) => a + b + 1, -1),
  },
  efn: {
    render: (node: TemplateNode) => (
      <Footnote>
        <Wikitext wikitext={node.parameters[0].value} />
      </Footnote>
    ),
    estimateLength: () => 6,
  },
  em: {
    render: (node: TemplateNode) => (
      <em>
        {node.parameters.map((child, i) => (
          <React.Fragment key={i}>{child.value}</React.Fragment>
        ))}
      </em>
    ),
    estimateLength: (node: TemplateNode) =>
      node.parameters.map((c) => c.value.length).reduce((a, b) => a + b, 0),
  },
  esccnty: {
    render: (node: TemplateNode) => <>{node.parameters[0].value}</>,
    estimateLength: (node: TemplateNode) =>
      node.parameters[0]?.value.length ?? 0,
  },
  escyr: {
    render: (node: TemplateNode) => (
      <>{node.parameters[2]?.value || node.parameters[0].value}</>
    ),
    estimateLength: (node: TemplateNode) =>
      (node.parameters[2]?.value ?? node.parameters[0]?.value ?? "").length,
  },
  etymology: {
    render: (node: TemplateNode) => <Etymology node={node} />,
    estimateLength: (node: TemplateNode) =>
      node.parameters[0]?.value.length ?? 0,
  },
  frac: {
    render: (node: TemplateNode) => {
      const p = node.parameters;
      if (p.length === 0) return <>&frasl;</>;
      if (p.length === 1) {
        return (
          <>
            <sup>1</sup>&frasl;
            <sub>
              <Wikitext wikitext={p[0].value} />
            </sub>
          </>
        );
      }
      if (p.length === 2) {
        return (
          <>
            <sup>
              <Wikitext wikitext={p[0].value} />
            </sup>
            &frasl;
            <sub>
              <Wikitext wikitext={p[1].value} />
            </sub>
          </>
        );
      }
      return (
        <>
          <Wikitext wikitext={p[0].value} />{" "}
          <sup>
            <Wikitext wikitext={p[1].value} />
          </sup>
          &frasl;
          <sub>
            <Wikitext wikitext={p[2].value} />
          </sub>
        </>
      );
    },
    estimateLength: (node: TemplateNode) =>
      node.parameters.map((p) => p.value.length).reduce((a, b) => a + b, 1),
  },
  gloss: {
    render: (node: TemplateNode) => {
      const text = node.parameters[0]?.value;
      if (!text) return null;
      return (
        <span>
          &lsquo;
          <Wikitext wikitext={text} />
          &rsquo;
        </span>
      );
    },
    estimateLength: (node: TemplateNode) =>
      (node.parameters[0]?.value.length ?? 0) + 2,
  },
  height: {
    render: (node: TemplateNode) => <Height node={node} />,
    estimateLength: () => 15,
  },
  iast: {
    render: (node: TemplateNode) => (
      <Wikitext
        wikitext={`{{Transliteration|sa|IAST|${node.parameters[0].value}}}`}
      />
    ),
    estimateLength: (node: TemplateNode) =>
      node.parameters[0]?.value.length ?? 0,
  },
  iast3: {
    render: (node: TemplateNode) => (
      <Wikitext wikitext={`[[IAST]]: {{IAST|${node.parameters[0].value}}}`} />
    ),
    estimateLength: (node: TemplateNode) =>
      (node.parameters[0]?.value.length ?? 0) + 6,
  },
  india_rs: {
    render: (node: TemplateNode) => {
      const args = templateToObject(node);
      const value = args["1"];
      const link = args["link"] === "yes";
      const symbol = link ? (
        <WikipediaLink pageTitle="Indian rupee">{"\u20B9"}</WikipediaLink>
      ) : (
        <>{"\u20B9"}</>
      );
      return value ? (
        <>
          {symbol}
          {value}
        </>
      ) : (
        symbol
      );
    },
    estimateLength: (node: TemplateNode) =>
      (node.parameters[0]?.value.length ?? 0) + 1,
  },
  interlanguage_link: {
    render: (node: TemplateNode) => <InterlanguageLink node={node} />,
    estimateLength: (node: TemplateNode) =>
      node.parameters[0]?.value.length ?? 0,
  },
  ipa: {
    render: (node: TemplateNode) => {
      const ipa =
        node.parameters.length > 1 ? node.parameters[1] : node.parameters[0];
      return <code>{ipa.value}</code>;
    },
    estimateLength: (node: TemplateNode) =>
      (node.parameters.length > 1 ? node.parameters[1] : node.parameters[0])
        ?.value.length ?? 0,
  },
  "ipa-all": {
    render: (node: TemplateNode) => <code>{node.parameters[0].value}</code>,
    estimateLength: (node: TemplateNode) =>
      node.parameters[0]?.value.length ?? 0,
  },
  "ipac-en": {
    render: (node: TemplateNode) => <IPAcEn node={node} />,
    estimateLength: (node: TemplateNode) => node.parameters.length * 2,
  },
  korean: {
    render: (node: TemplateNode) => (
      <span>Korean: {node.parameters[0].value}</span>
    ),
    estimateLength: (node: TemplateNode) =>
      8 + (node.parameters[0]?.value.length ?? 0),
  },
  "korean/auto": {
    render: (node: TemplateNode) => <KoreanAuto node={node} />,
    estimateLength: (node: TemplateNode) =>
      (node.parameters[0]?.value.length ?? 0) + 8,
  },
  lang: {
    render: (node: TemplateNode) => (
      <span>
        <Wikitext wikitext={node.parameters[1].value} />
      </span>
    ),
    estimateLength: (node: TemplateNode) =>
      node.parameters[1]?.value.length ?? 0,
  },
  "lang-ka": {
    render: (node: TemplateNode) => (
      <span>Georgian: {node.parameters[0].value}</span>
    ),
    estimateLength: (node: TemplateNode) =>
      10 + (node.parameters[0]?.value.length ?? 0),
  },
  "lang-rus": {
    render: (node: TemplateNode) => (
      <span>
        Russian: {node.parameters[0].value}
        {node.parameters.length > 1 && (
          <>
            , romanized: <Wikitext wikitext={node.parameters[1].value} />
          </>
        )}
      </span>
    ),
    estimateLength: (node: TemplateNode) =>
      9 +
      (node.parameters[0]?.value.length ?? 0) +
      (node.parameters.length > 1
        ? 13 + (node.parameters[1]?.value.length ?? 0)
        : 0),
  },
  "lang-sh-cyrl": {
    render: (node: TemplateNode) => (
      <span>Serbo-Croatian Cyrillic: {node.parameters[0].value}</span>
    ),
    estimateLength: (node: TemplateNode) =>
      25 + (node.parameters[0]?.value.length ?? 0),
  },
  "lang-sr-cyr": {
    render: (node: TemplateNode) => (
      <span>Serbian Cyrillic: {node.parameters[0].value}</span>
    ),
    estimateLength: (node: TemplateNode) =>
      18 + (node.parameters[0]?.value.length ?? 0),
  },
  "lang-sr-cyrl-latn": {
    render: (node: TemplateNode) => {
      const args = templateToObject(node);
      const separator = args.separator || ", ";
      return (
        <span>
          {args["1"]} {separator} <Wikitext wikitext={args["2"]} />
        </span>
      );
    },
    estimateLength: (node: TemplateNode) => {
      const args = templateToObject(node);
      return (
        (args["1"]?.length ?? 0) +
        (args["2"]?.length ?? 0) +
        (args.separator?.length ?? 2) +
        2
      );
    },
  },
  "lang-su-fonts": {
    render: (node: TemplateNode) => (
      <Wikitext wikitext={node.parameters[0].value} />
    ),
    estimateLength: (node: TemplateNode) =>
      node.parameters[0]?.value.length ?? 0,
  },
  langx: {
    render: (node: TemplateNode) => <Langx node={node} />,
    estimateLength: (node: TemplateNode) =>
      (node.parameters[1]?.value ?? node.parameters[0]?.value ?? "").length + 5,
  },
  "language_with_name/for": {
    render: (node: TemplateNode) => <Langnf node={node} />,
    estimateLength: (node: TemplateNode) =>
      (node.parameters[1]?.value ?? node.parameters[0]?.value ?? "").length + 5,
  },
  linktext: {
    render: (node: TemplateNode) => (
      <>
        {node.parameters
          .filter((c) => c.name !== "pref")
          .map((c) => c.value)
          .join("")}
      </>
    ),
    estimateLength: (node: TemplateNode) =>
      node.parameters
        .filter((c) => c.name !== "pref")
        .map((c) => c.value.length)
        .reduce((a, b) => a + b, 0),
  },
  listen: {
    render: (node: TemplateNode) => <Listen node={node} />,
    estimateLength: () => 0,
  },
  lit: {
    render: (node: TemplateNode) => {
      const params = node.parameters.filter((p) => p.name !== "lk");
      return (
        <span>
          <abbr
            title="literal translation"
            className={`text-sm border-b border-dotted ${colourStyles.border.abbr} cursor-help`}
          >
            lit.
          </abbr>{" "}
          {params.map((p, index) => (
            <React.Fragment key={index}>
              {index > 0 && " or "}
              &lsquo;
              <Wikitext wikitext={p.value} />
              &rsquo;
            </React.Fragment>
          ))}
        </span>
      );
    },
    estimateLength: (node: TemplateNode) =>
      5 +
      node.parameters
        .filter((p) => p.name !== "lk")
        .map((p) => p.value.length + 6)
        .reduce((a, b) => a + b, 0),
  },
  mongolunicode: {
    render: (node: TemplateNode) => <Mongolunicode node={node} />,
    estimateLength: (node: TemplateNode) =>
      node.parameters[0]?.value.length ?? 0,
  },
  music: {
    render: (node: TemplateNode) => (
      <Music
        symbol={node.parameters[0]?.value || ""}
        param2={node.parameters[1]?.value}
        param3={node.parameters[2]?.value}
      />
    ),
    estimateLength: () => 1,
  },
  nihongo: {
    render: (node: TemplateNode) => <Nihongo node={node} variant="nihongo" />,
    estimateLength: (node: TemplateNode) =>
      (node.parameters[0]?.value.length ?? 0) +
      (node.parameters[1]?.value.length ?? 0) +
      5,
  },
  nihongo2: {
    render: (node: TemplateNode) => <>{node.parameters[0].value}</>,
    estimateLength: (node: TemplateNode) =>
      node.parameters[0]?.value.length ?? 0,
  },
  nihongo3: {
    render: (node: TemplateNode) => <Nihongo node={node} variant="nihongo3" />,
    estimateLength: (node: TemplateNode) =>
      (node.parameters[0]?.value.length ?? 0) +
      (node.parameters[1]?.value.length ?? 0) +
      5,
  },
  nihongo4: {
    render: (node: TemplateNode) => <Nihongo node={node} variant="nihongo4" />,
    estimateLength: (node: TemplateNode) =>
      (node.parameters[0]?.value.length ?? 0) +
      (node.parameters[1]?.value.length ?? 0) +
      5,
  },
  not_a_typo: {
    render: (node: TemplateNode) => (
      <>{node.parameters.map((c) => c.value).join("")}</>
    ),
    estimateLength: (node: TemplateNode) =>
      node.parameters.map((c) => c.value.length).reduce((a, b) => a + b, 0),
  },
  nobold: {
    render: (node: TemplateNode) => (
      <span style={{ fontWeight: "normal" }}>
        <Wikitext wikitext={node.parameters[0].value} />
      </span>
    ),
    estimateLength: (node: TemplateNode) =>
      node.parameters[0]?.value.length ?? 0,
  },
  noitalic: {
    render: (node: TemplateNode) => (
      <span className="not-italic">
        <Wikitext wikitext={node.parameters[0].value} />
      </span>
    ),
    estimateLength: (node: TemplateNode) =>
      node.parameters[0]?.value.length ?? 0,
  },
  nowrap: {
    render: (node: TemplateNode) => (
      <span className="whitespace-nowrap">
        <Wikitext wikitext={node.parameters[0].value} />
      </span>
    ),
    estimateLength: (node: TemplateNode) =>
      node.parameters[0]?.value.length ?? 0,
  },
  numero: {
    render: (node: TemplateNode) => {
      const isPlural = node.parameters.some((p) => p.name === "plural");
      const text = isPlural ? "Nos." : "No.";
      const number = node.parameters[0]?.value;
      if (number)
        return (
          <>
            {text} <Wikitext wikitext={number} />
          </>
        );
      return <>{text}</>;
    },
    estimateLength: (node: TemplateNode) =>
      4 + (node.parameters[0]?.value.length ?? 0),
  },
  "\u20B1": {
    render: (node: TemplateNode) => (
      <>
        {"\u20B1"}
        {node.parameters.length > 0 ? node.parameters[0].value : ""}
      </>
    ),
    estimateLength: (node: TemplateNode) =>
      (node.parameters[0]?.value.length ?? 0) + 1,
  },
  post_nominals: {
    render: (node: TemplateNode) => <PostNominals node={node} />,
    estimateLength: (node: TemplateNode) => node.parameters.length * 4,
  },
  respelling: {
    render: (node: TemplateNode) => (
      <span className="italic">
        {node.parameters.map((p, i) => (
          <React.Fragment key={i}>
            {i > 0 && "-"}
            <Wikitext wikitext={p.value} />
          </React.Fragment>
        ))}
      </span>
    ),
    estimateLength: (node: TemplateNode) =>
      node.parameters
        .map((p) => p.value.length)
        .reduce((a, b) => a + b + 1, -1),
  },
  rtgs: {
    render: (node: TemplateNode) => (
      <>
        <WikipediaLink pageTitle="Royal Thai General System of Transcription">
          RTGS
        </WikipediaLink>
        : <Wikitext wikitext={node.parameters[0].value} />
      </>
    ),
    estimateLength: (node: TemplateNode) =>
      6 + (node.parameters[0]?.value.length ?? 0),
  },
  ruby: {
    render: (node: TemplateNode) => (
      <ruby>
        {node.parameters[0].value}
        <rp>(</rp>
        <rt>{node.parameters[1].value}</rt>
        <rp>)</rp>
      </ruby>
    ),
    estimateLength: (node: TemplateNode) =>
      (node.parameters[0]?.value.length ?? 0) +
      (node.parameters[1]?.value.length ?? 0) +
      2,
  },
  "sans-serif": {
    render: (node: TemplateNode) => (
      <Wikitext wikitext={node.parameters[0].value} />
    ),
    estimateLength: (node: TemplateNode) =>
      node.parameters[0]?.value.length ?? 0,
  },
  script: {
    render: (node: TemplateNode) => (
      <Wikitext wikitext={node.parameters[1].value} />
    ),
    estimateLength: (node: TemplateNode) =>
      node.parameters[1]?.value.length ?? 0,
  },
  "script/hebrew": {
    render: (node: TemplateNode) => (
      <Wikitext wikitext={node.parameters[0].value} />
    ),
    estimateLength: (node: TemplateNode) =>
      node.parameters[0]?.value.length ?? 0,
  },
  small: {
    render: (node: TemplateNode) => (
      <small>
        {node.parameters.map((c, i) => (
          <Wikitext key={i} wikitext={c.value} />
        ))}
      </small>
    ),
    estimateLength: (node: TemplateNode) =>
      node.parameters.map((c) => c.value.length).reduce((a, b) => a + b, 0),
  },
  start_date: {
    render: (node: TemplateNode) => <StartDate node={node} />,
    estimateLength: () => 15,
  },
  spaces: {
    render: (node: TemplateNode) => {
      const numSpaces = parseInt(node.parameters[0]?.value) || 1;
      const type = node.parameters[1]?.value;
      let spaceChar;
      switch (type) {
        case "em":
          spaceChar = "\u2003";
          break;
        case "en":
          spaceChar = "\u2002";
          break;
        case "thin":
          spaceChar = "\u2009";
          break;
        case "hair":
          spaceChar = "\u200A";
          break;
        case "fig":
          spaceChar = "\u2007";
          break;
        default:
          spaceChar = "\u00A0";
          break;
      }
      return <>{Array(numSpaces).fill(spaceChar).join("")}</>;
    },
    estimateLength: (node: TemplateNode) =>
      parseInt(node.parameters[0]?.value) || 1,
  },
  sup: {
    render: (node: TemplateNode) => (
      <sup>
        <Wikitext wikitext={node.parameters[0].value} />
      </sup>
    ),
    estimateLength: (node: TemplateNode) =>
      node.parameters[0]?.value.length ?? 0,
  },
  thin_space: {
    render: (node: TemplateNode) => {
      if (node.parameters.length == 0) return <>&thinsp;</>;
      if (node.parameters.length == 1)
        return <>&thinsp;{node.parameters[0].value}&thinsp;</>;
      return node.parameters.map((p, i) => (
        <React.Fragment key={i}>
          {i > 0 && <>&thinsp;</>}
          <Wikitext wikitext={p.value} />
        </React.Fragment>
      ));
    },
    estimateLength: (node: TemplateNode) =>
      node.parameters
        .map((p) => p.value.length + 1)
        .reduce((a, b) => a + b, 0) || 1,
  },
  transliteration: {
    render: (node: TemplateNode) => (
      <span>
        {node.parameters.length > 2
          ? node.parameters[2].value
          : node.parameters[1].value}
      </span>
    ),
    estimateLength: (node: TemplateNode) =>
      (node.parameters.length > 2 ? node.parameters[2] : node.parameters[1])
        ?.value.length ?? 0,
  },
  us$: {
    render: (node: TemplateNode) => <>${node.parameters[0].value}</>,
    estimateLength: (node: TemplateNode) =>
      (node.parameters[0]?.value.length ?? 0) + 1,
  },
  uss: {
    render: (node: TemplateNode) => {
      if (node.parameters.length === 0) return <>USS</>;
      if (node.parameters.length === 1)
        return <>USS {node.parameters[0].value}</>;
      return (
        <>
          USS {node.parameters[0].value} ({node.parameters[1].value})
        </>
      );
    },
    estimateLength: (node: TemplateNode) => {
      if (node.parameters.length === 0) return 3;
      if (node.parameters.length === 1)
        return 4 + (node.parameters[0]?.value.length ?? 0);
      return (
        6 +
        (node.parameters[0]?.value.length ?? 0) +
        (node.parameters[1]?.value.length ?? 0)
      );
    },
  },
  "wikt-lang": {
    render: (node: TemplateNode) => <WiktLang node={node} />,
    estimateLength: (node: TemplateNode) =>
      node.parameters[1]?.value.length ?? 0,
  },
  "lang-zh": {
    render: (node: TemplateNode) => <Zh node={node} />,
    estimateLength: (node: TemplateNode) =>
      (node.parameters[0]?.value.length ?? 0) + 10,
  },
  time_ago: {
    render: (node: TemplateNode) => <TimeAgo node={node} />,
    estimateLength: () => 12,
  },
} satisfies Record<string, TemplateHandler>;

type CanonicalTemplateName = keyof typeof canonicalHandlers;

// -- Aliases ----------------------------------------------------------------
// Alias targets are compile-time checked against CanonicalTemplateName.

const aliases: [string, CanonicalTemplateName][] = [
  // hidden
  ["clear_left", "clear"],
  ["clear_right", "clear"],
  ["culture_of_peru", "culture_of_colombia"],
  ["music-genre-stub", "music_genre_stub"],
  ["music_of_jamaica", "music_of_cape_verde"],
  ["script/nastaliq", "nastaliq"],
  ["nq", "nastaliq"],
  ["ref label", "ref_label"],
  ["toclimit", "toc_limit"],
  ["use_indian_english", "use_dmy_dates"],
  ["sfnp", "sfn"],
  ["snf", "sfn"],

  // fixed
  ["also_known_as", "aka"],
  ["a.k.a.", "aka"],
  ["c.", "circa"],
  ["emdash", "em_dash"],
  ["mdash", "em_dash"],
  ["--", "em_dash"],
  ["endash", "en_dash"],
  ["ndash", "en_dash"],
  ["ne", "n\u00E9"],
  ["hairsp", "hair_space"],
  ["snd", "spaced_en_dash"],
  ["spaced_ndash", "spaced_en_dash"],
  ["spnd", "spaced_en_dash"],
  ["snds", "spaced_en_dash_space"],
  ["px2", "two_pixel_space"],
  ["'-", "single+space"],

  // fix
  ["according_to_whom?", "according_to_whom"],
  ["better_source_needed", "better_source"],
  ["by_whom?", "by_whom"],
  ["cn", "citation_needed"],
  ["cita_requerida", "citation_needed"],
  ["citesource", "citation_needed"],
  ["fact", "citation_needed"],
  ["facts", "citation_needed"],
  ["source_needed", "citation_needed"],
  ["source?", "source"],
  ["not_verified_in_body", "citation_needed_lead"],
  ["clarification_needed", "clarify"],
  ["clarification_needed_span", "clarify_span"],
  ["contradictory_inline", "contradiction-inline"],
  ["dn", "disambiguation_needed"],
  ["excessive_citations", "excessive_citations_inline"],
  ["not_in_ref", "failed_verification"],
  ["verification_failed", "failed_verification"],
  ["pn", "page_needed"],
  ["pronunciation?", "pronunciation_needed"],
  ["pron", "pronunciation_needed"],
  ["sps", "self-published_inline"],
  ["unreliable_source?", "unreliable_source"],
  ["unreliable_source_inline", "unreliable_source"],
  ["what?", "what"],
  ["when?", "when"],
  ["which?", "which"],
  ["where?", "where"],
  ["who?", "who"],

  // component
  ["blockquote", "quote"],
  ["cquote", "quote"],
  ["efn-ua", "efn"],
  ["ety", "etymology"],
  ["ill", "interlanguage_link"],
  ["interlanguage_link_multi", "interlanguage_link"],
  ["ipa-cen", "ipac-en"],
  ["ko-hhrm", "korean"],
  ["lang-latn", "lang"],
  ["langnf", "language_with_name/for"],
  ["langr", "lang"],
  ["lang_unset_italics", "lang"],
  ["sund", "lang-su-fonts"],
  ["lang-sr-cyrl", "lang-sr-cyr"],
  ["lit.", "lit"],
  ["literal", "lit"],
  ["literally", "lit"],
  ["literal_translation", "lit"],
  ["notatypo", "not_a_typo"],
  ["proper_name", "not_a_typo"],
  ["nobr", "nowrap"],
  ["post-nominal_styles", "post_nominals"],
  ["post-nominal", "post_nominals"],
  ["post-nominals", "post_nominals"],
  ["postnom", "post_nominals"],
  ["postnominal", "post_nominals"],
  ["postnominals", "post_nominals"],
  ["respell", "respelling"],
  ["smaller", "small"],
  ["thinspace", "thin_space"],
  ["thinsp", "thin_space"],
  ["tlit", "transliteration"],
  ["translit", "transliteration"],
  ["transl", "transliteration"],
  ["xlit", "transliteration"],
  ["us_dollar", "us$"],
  ["wt", "wikt-lang"],
  ["zh", "lang-zh"],
  ["timeago", "time_ago"],
  ["phillippine_peso", "\u20B1"],
  ["indian_rupee", "india_rs"],
  ["indian_rupee_symbol", "india_rs"],
  ["indian_rupees", "india_rs"],
  ["inr", "india_rs"],
  ["\u20B9", "india_rs"],
];

// Build runtime lookup from canonical handlers + aliases
const templateHandlers = new Map<string, TemplateHandler>(
  Object.entries(canonicalHandlers)
);
for (const [alias, canonical] of aliases) {
  templateHandlers.set(alias, canonicalHandlers[canonical]);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
 * Renders a Wikitext simplified template node using the dispatch table.
 */
export function WikitextTemplate({ node }: { node: TemplateNode }) {
  const wikiUrl = useWikiUrl();

  const templateName = node.name
    .replace(/^template:/, "")
    .replace(/ /g, "_")
    .toLowerCase();

  if (templateName.startsWith("defaultsort")) {
    return null;
  }

  const handler = templateHandlers.get(templateName);
  if (handler) {
    return <>{handler.render(node)}</>;
  }

  throw new MissingTemplateError(templateName, wikiUrl ?? undefined);
}

/** Estimate the rendered text length of a template, using the dispatch table. */
export function estimateTemplateLength(node: TemplateNode): number {
  const name = node.name
    .replace(/^template:/, "")
    .replace(/ /g, "_")
    .toLowerCase();

  if (name.startsWith("defaultsort")) return 0;

  const handler = templateHandlers.get(name);
  if (!handler) {
    return node.parameters[0]?.value.length ?? 0;
  }
  return handler.estimateLength(node);
}
