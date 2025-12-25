import { WikitextSimplifiedNode } from "frontend_wasm";
import { templateToObject } from "./util";
import { IetfLanguageTagLink } from "../IetfLanguageTagLink";
import { Wikitext } from "../wikitexts/Wikitext";

/**
 * Renders the etymology template.
 * Takes groups of three parameters (triplets) that indicate a part of an etymology.
 * Each triplet: language (ISO 639 code), orthography (original text), meaning (English gloss).
 */
export function Etymology({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  const params = templateToObject(node);

  // Extract triplets (up to 6)
  const triplets: Array<{
    language?: string;
    orthography?: string;
    meaning?: string;
  }> = [];

  for (let i = 0; i < 6; i++) {
    const langIdx = i * 3 + 1;
    const orthoIdx = i * 3 + 2;
    const meaningIdx = i * 3 + 3;

    const language = params[langIdx.toString()]?.trim();
    const orthography = params[orthoIdx.toString()]?.trim();
    const meaning = params[meaningIdx.toString()]?.trim();

    // At least one of language or orthography must be specified
    if (language || orthography) {
      triplets.push({ language, orthography, meaning });
    }
  }

  if (triplets.length === 0) {
    return null;
  }

  return (
    <>
      from{" "}
      {triplets.map((triplet, index) => (
        <span key={index}>
          {index > 0 && " + "}
          {triplet.language && (
            <>
              <LanguageReference tag={triplet.language} />{" "}
            </>
          )}
          {triplet.orthography && <Wikitext wikitext={triplet.orthography} />}
          {triplet.meaning && (
            <>
              {" "}
              '<Wikitext wikitext={triplet.meaning} />'
            </>
          )}
        </span>
      ))}
    </>
  );
}

/**
 * Attempts to render a language reference using the IETF language tag.
 * Falls back to displaying the tag as-is if not recognized.
 */
function LanguageReference({ tag }: { tag: string }) {
  try {
    return <IetfLanguageTagLink tag={tag} />;
  } catch {
    // If the language tag is not recognized, just display it as-is
    return <>{tag}</>;
  }
}
