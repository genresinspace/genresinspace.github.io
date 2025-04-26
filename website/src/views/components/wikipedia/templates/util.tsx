import { WikitextSimplifiedNode } from "frontend_wasm";

/** Given a template, return an object with the parameters as keys and the values as values. */
export function templateToObject(
  template: Extract<WikitextSimplifiedNode, { type: "template" }>
) {
  return Object.fromEntries(template.parameters.map((p) => [p.name, p.value]));
}
