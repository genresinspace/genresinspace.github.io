import { WikitextSimplifiedNode } from "frontend_wasm";
import { templateToObject } from "./util";

/**
 * Renders the possible birth year(s) inferred from a person's age at death.
 * {{Birth based on age at death|age|death_year|death_month|death_day}}
 * Without a known birthday, the birth year is one of two candidates:
 * death_year - age - 1 (birthday not yet reached) or death_year - age.
 * e.g. {{Birth based on age at death|52|2026|01|30}} -> 1973 or 1974
 * With |slash=yes the two years are joined with a slash: 1973/1974.
 */
export function BirthBasedOnAgeAtDeath({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  const params = templateToObject(node);

  const age = parseInt(params["1"]);
  const deathYear = parseInt(params["2"]);
  if (isNaN(age) || isNaN(deathYear)) {
    return <span>Error: Invalid age or year</span>;
  }

  const earliestBirthYear = deathYear - age - 1;
  const latestBirthYear = deathYear - age;

  const separator = params["slash"] === "yes" ? "/" : " or ";
  return (
    <>
      {earliestBirthYear}
      {separator}
      {latestBirthYear}
    </>
  );
}
