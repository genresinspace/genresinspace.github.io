import { WikitextSimplifiedNode } from "frontend_wasm";

import { Wikitext } from "../wikitexts/Wikitext";
import { templateToObject } from "./util";
import { romanizeHangul } from "../../../../util/romanizeHangul";

/** The `korean/auto` template, which displays Korean text with various romanizations and translations */
export function KoreanAuto({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  const params = templateToObject(node);

  // Extract parameters
  const hangul = params["hangul"] || params["1"];
  const hangulref = params["hangulref"];
  const hanja = params["hanja"] || params["2"];
  const hanjaref = params["hanjaref"];
  const rr = params["rr"] === "yes";
  const mr = params["mr"] === "yes";
  const lit = params["lit"];
  const litref = params["litref"];
  const en_ipa = params["en_ipa"];
  const en_iparef = params["en_iparef"];
  const ko_ipa = params["ko_ipa"];
  const ko_iparef = params["ko_iparef"];
  const labels = params["labels"] !== "no"; // default yes
  const links = params["links"] !== "no"; // default yes
  const namemode = params["namemode"] === "yes";
  const capitalize = params["capitalize"] === "yes";
  const out = params["out"] === "yes";
  const en_out = params["en_out"] === "yes";

  // Determine order
  let order = params["order"];
  if (en_out) {
    order = order || "lehzrmk";
  } else {
    order = order || "ehzrmkl";
  }

  if (!hangul) {
    return null;
  }

  // Apply namemode and capitalize by modifying hangul with symbols
  let processedHangul = hangul;
  if (namemode && !hangul.startsWith("%")) {
    processedHangul = "%" + processedHangul;
  }
  if (capitalize && !hangul.startsWith("^")) {
    processedHangul = "^" + processedHangul;
  }

  // Clean hangul for display (remove romanization symbols)
  const displayHangul = processedHangul.replace(/[%^]/g, "");

  // Build components based on order
  const components: Array<{ key: string; content: string }> = [];

  for (const char of order) {
    switch (char) {
      case "e": // English IPA
        if (en_ipa) {
          const label = labels
            ? links
              ? "[[Help:IPA/English|IPA]]"
              : "IPA"
            : "";
          const content = label ? `${label}: [${en_ipa}]` : `[${en_ipa}]`;
          components.push({
            key: "en_ipa",
            content: content + (en_iparef || ""),
          });
        }
        break;
      case "h": // Hangul
        if (hangul) {
          const label = labels
            ? links
              ? "[[Korean language|Korean]]"
              : "Korean"
            : "";
          const content = label ? `${label}: ${displayHangul}` : displayHangul;
          components.push({
            key: "hangul",
            content: content + (hangulref || ""),
          });
        }
        break;
      case "z": // Hanja
        if (hanja) {
          const label = labels ? (links ? "[[Hanja]]" : "Hanja") : "";
          const content = label ? `${label}: ${hanja}` : hanja;
          components.push({
            key: "hanja",
            content: content + (hanjaref || ""),
          });
        }
        break;
      case "r": // Revised Romanization
        if (rr) {
          const label = labels
            ? links
              ? "[[Revised Romanization of Korean|RR]]"
              : "RR"
            : "";
          const romanization = romanizeHangul(processedHangul, true);
          const content = label ? `${label}: ${romanization}` : romanization;
          components.push({
            key: "rr",
            content: content,
          });
        }
        break;
      case "m": // McCune-Reischauer
        if (mr) {
          const label = labels
            ? links
              ? "[[McCune–Reischauer|MR]]"
              : "MR"
            : "";
          const romanization = romanizeHangul(processedHangul, false);
          const content = label ? `${label}: ${romanization}` : romanization;
          components.push({
            key: "mr",
            content: content,
          });
        }
        break;
      case "k": // Korean IPA
        if (ko_ipa) {
          const label = labels
            ? links
              ? "[[Help:IPA/Korean|IPA]]"
              : "IPA"
            : "";
          const content = label ? `${label}: [${ko_ipa}]` : `[${ko_ipa}]`;
          components.push({
            key: "ko_ipa",
            content: content + (ko_iparef || ""),
          });
        }
        break;
      case "l": // Literal translation
        if (lit) {
          const label = labels ? "lit." : "";
          const content = label ? `${label} '${lit}'` : `'${lit}'`;
          components.push({
            key: "lit",
            content: content + (litref || ""),
          });
        }
        break;
    }
  }

  if (components.length === 0) {
    return null;
  }

  // Build final result
  let result = "";

  if (out || en_out) {
    // First component outside parentheses, rest inside
    result = components[0].content;
    if (components.length > 1) {
      const remaining = components
        .slice(1)
        .map((c) => c.content)
        .join(", ");
      result += ` (${remaining})`;
    }
  } else {
    // All components separated by commas or semicolons
    result = components.map((c) => c.content).join("; ");
  }

  return <Wikitext wikitext={result} />;
}
