import { WikitextSimplifiedNode } from "frontend_wasm";

import { Wikitext } from "../wikitexts/Wikitext";
import { templateToObject } from "./util";

/** The `nihongo` template, which displays Japanese text with an English translation */
export function Nihongo({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  const params = templateToObject(node);

  const english = params["1"];
  const kanjiKana = params["2"] || undefined;
  const romaji = params["3"] || undefined;
  const extra = params["4"] || params["extra"] || undefined;
  const extra2 = params["5"] || params["extra2"] || undefined;

  const lead = params["lead"] === "yes";

  // Construct the display based on the template documentation
  let result = "";

  // Add the English term if provided
  if (english) {
    result += english;
  }

  // Add the Japanese script and romaji
  if (kanjiKana || romaji) {
    // If this is the first instance in the lead, add a language indicator
    if (lead) {
      result += ` ([[Japanese language|Japanese]]: `;
    } else if (result) {
      result += ` (`;
    }

    // Add kanji/kana if provided
    if (kanjiKana) {
      result += kanjiKana;
    }

    // Add romaji if provided
    if (romaji) {
      if (kanjiKana) {
        result += `, `;
      }
      result += `[[Hepburn romanization|Hepburn]]: ''${romaji}''`;
    }

    // Add extra information if provided (within the parentheses)
    if (extra) {
      result += `, ${extra}`;
    }

    // Close the parentheses
    result += `)`;
  }

  // Add extra2 information if provided (outside the parentheses)
  if (extra2) {
    result += ` ${extra2}`;
  }

  return <Wikitext wikitext={result}></Wikitext>;
}
