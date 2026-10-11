import { WikitextSimplifiedNode } from "frontend_wasm";

import { WikipediaLink } from "../links/WikipediaLink";
import { Wikitext } from "../wikitexts/Wikitext";
import { templateToObject } from "./util";

type TemplateNode = Extract<WikitextSimplifiedNode, { type: "template" }>;

const states: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  AS: "American Samoa",
  GU: "Guam",
  MP: "Northern Mariana Islands",
  PR: "Puerto Rico",
  VI: "United States Virgin Islands",
};

const atLargeSeats = new Set([
  "Maryland",
  "Massachusetts",
  "New York",
  "North Carolina",
  "Oklahoma",
  "South Carolina",
  "Texas",
  "Virginia",
  "West Virginia",
]);

function districtLink(node: TemplateNode) {
  const params = templateToObject(node);
  const stateInput = (params["1"] ?? "").trim();
  const stateEntry = Object.entries(states).find(
    ([abbreviation, name]) =>
      abbreviation === stateInput.toUpperCase() ||
      name.toLowerCase() === stateInput.toLowerCase()
  );
  const state = stateEntry?.[1] ?? stateInput;
  const abbreviation = stateEntry?.[0] ?? stateInput;
  const possessive = `${state}${state.endsWith("Islands") ? "'" : "'s"}`;
  const district = (params["2"] ?? "").trim();
  const atLarge = district.toUpperCase() === "AL";
  const number = Number(district);
  const suffix =
    number % 100 >= 11 && number % 100 <= 13
      ? "th"
      : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[
          number % 10
        ] ?? "th");
  const ordinal = atLarge ? "at-large" : `${district}${suffix}`;
  const districtName = atLarge && atLargeSeats.has(state) ? "seat" : "district";
  const pageTitle = `${possessive} ${ordinal} congressional ${districtName}`;
  const display = params["3"]?.trim() ?? "";
  let label = pageTitle;

  switch (display.toUpperCase()) {
    case "A":
      label = `${possessive}\u00A0${ordinal} ${districtName}`;
      break;
    case "B":
      label = `${abbreviation} ${atLarge ? "at-large" : district}`;
      break;
    case "C":
      label = `${ordinal} ${districtName}`;
      break;
    case "D":
      label = `${ordinal} congressional ${districtName}`;
      break;
    case "E":
      label = atLarge ? "At-large" : district;
      break;
    case "H":
      label = `${abbreviation}\u2011${atLarge ? "AL" : district}`;
      break;
    case "R":
      label = atLarge ? "At-large" : ordinal;
      break;
    case "S":
      label = `${possessive}\u00A0${ordinal}`;
      break;
    case "T":
      label = `${state}\u00A0${ordinal}`;
      break;
    case "U":
      label = state;
      break;
    case "X":
      label = `${state}\u00A0${atLarge ? "at-large" : district}`;
      break;
    default:
      label = display || pageTitle;
  }

  return { pageTitle, label };
}

/** Renders a link to a U.S. House congressional district. */
export function USHouseDistrict({ node }: { node: TemplateNode }) {
  const { pageTitle, label } = districtLink(node);
  return (
    <WikipediaLink pageTitle={pageTitle}>
      <Wikitext wikitext={label} />
    </WikipediaLink>
  );
}

/** Returns the length of the congressional district link's display text. */
export function estimateUSHouseDistrictLength(node: TemplateNode): number {
  return districtLink(node).label.length;
}
