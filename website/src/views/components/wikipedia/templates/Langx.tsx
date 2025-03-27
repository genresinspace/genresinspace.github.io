import { WikitextSimplifiedNode } from "wikitext_simplified";
import { templateToObject } from "./util";
import { IetfLanguageTagLink } from "../IetfLanguageTagLink";
import { Wikitext } from "../wikitexts/Wikitext";

/**
 * Renders the langx template.
 */
export function Langx({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
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
