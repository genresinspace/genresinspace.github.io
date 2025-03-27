import { WikitextSimplifiedNode } from "wikitext_simplified";

/** Given a template, return an object with the parameters as keys and the values as values. */
export function templateToObject(
  template: Extract<WikitextSimplifiedNode, { type: "template" }>
) {
  return Object.fromEntries(template.children.map((c) => [c.name, c.value]));
}
