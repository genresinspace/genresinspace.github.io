import React from "react";
import { WikitextSimplifiedNode } from "frontend_wasm";
import { Wikitext } from "../wikitexts/Wikitext";

/**
 * Renders the `zh` template, which is used to render Chinese language text.
 */
export function Zh({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
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
}
