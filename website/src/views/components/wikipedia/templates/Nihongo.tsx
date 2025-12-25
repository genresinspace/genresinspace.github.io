import { WikitextSimplifiedNode } from "frontend_wasm";

import { Wikitext } from "../wikitexts/Wikitext";
import { templateToObject } from "./util";

type NihongoVariant = "nihongo" | "nihongo3" | "nihongo4";

/**
 * The `nihongo` family of templates, which display Japanese text with translations.
 *
 * - nihongo: English (Kanji, Hepburn: romaji, extra) extra2
 * - nihongo3: romaji (Kanji, English, extra) extra2 - rōmaji first, auto-italicized
 * - nihongo4: same as nihongo but without "Hepburn:" prefix
 */
export function Nihongo({
  node,
  variant = "nihongo",
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
  variant?: NihongoVariant;
}) {
  const params = templateToObject(node);

  const english = params["1"];
  const kanjiKana = params["2"] || undefined;
  const romaji = params["3"] || undefined;
  const extra = params["4"] || params["extra"] || undefined;
  const extra2 = params["5"] || params["extra2"] || undefined;

  const lead = params["lead"] === "yes";

  // nihongo3 reverses the order: rōmaji first, then (kanji, english)
  if (variant === "nihongo3") {
    return (
      <Wikitext
        wikitext={buildNihongo3(romaji, kanjiKana, english, extra, extra2)}
      />
    );
  }

  // nihongo and nihongo4: English (Kanji, romaji, extra) extra2
  const showHepburn = variant === "nihongo";

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
      if (showHepburn) {
        result += `[[Hepburn romanization|Hepburn]]: `;
      }
      result += `''${romaji}''`;
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

/**
 * Builds the nihongo3 format: romaji (Kanji, English, extra) extra2
 * Rōmaji comes first (auto-italicized), with kanji and English inside parentheses.
 */
function buildNihongo3(
  romaji: string | undefined,
  kanjiKana: string | undefined,
  english: string | undefined,
  extra: string | undefined,
  extra2: string | undefined
): string {
  let result = "";

  // Add romaji first (italicized)
  if (romaji) {
    result += `''${romaji}''`;
  }

  // Build parenthetical content: (kanji, english, extra)
  const parenParts: string[] = [];
  if (kanjiKana) {
    parenParts.push(kanjiKana);
  }
  if (english) {
    parenParts.push(english);
  }
  if (extra) {
    parenParts.push(extra);
  }

  if (parenParts.length > 0) {
    if (result) {
      result += " ";
    }
    result += `(${parenParts.join(", ")})`;
  }

  // Add extra2 outside parentheses
  if (extra2) {
    result += ` ${extra2}`;
  }

  return result;
}
