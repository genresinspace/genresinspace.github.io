import { WikitextSimplifiedNode } from "frontend_wasm";
import { templateToObject } from "./util";
import { numberToWords } from "../../../../util/numberToWords";

// Time units in seconds
const TIME_UNITS = [
  { key: "years", seconds: 31557600, singular: "year", plural: "years" },
  { key: "months", seconds: 2629800, singular: "month", plural: "months" }, // 365.25*24*60*60/12
  { key: "weeks", seconds: 604800, singular: "week", plural: "weeks" },
  { key: "days", seconds: 86400, singular: "day", plural: "days" },
  { key: "hours", seconds: 3600, singular: "hour", plural: "hours" },
  { key: "minutes", seconds: 60, singular: "minute", plural: "minutes" },
  { key: "seconds", seconds: 1, singular: "second", plural: "seconds" },
];

function parseDate(input: string): Date | null {
  // Try to parse as ISO, then as Date, then as relative (e.g. -83 minutes)
  if (!input) return null;
  // Relative time (e.g. -83 minutes)
  const relMatch = input.match(
    /([+-]?)(\d+)\s*(seconds?|minutes?|hours?|days?|weeks?|months?|years?)/i
  );
  if (relMatch) {
    const sign = relMatch[1] === "-" ? -1 : 1;
    const value = parseInt(relMatch[2], 10);
    const unit = relMatch[3].toLowerCase();
    const now = new Date();
    const seconds =
      value *
      sign *
      (TIME_UNITS.find((u) => unit.startsWith(u.key.slice(0, -1)))?.seconds ||
        0);
    return new Date(now.getTime() + seconds * 1000);
  }
  // Try parsing as a number (year)
  if (/^\d{4}$/.test(input.trim())) {
    return new Date(Date.UTC(parseInt(input.trim(), 10), 0, 1));
  }
  // Try parsing as YYYYMMDDHHMMSS
  if (/^\d{14}$/.test(input.trim())) {
    const y = parseInt(input.slice(0, 4), 10);
    const m = parseInt(input.slice(4, 6), 10) - 1;
    const d = parseInt(input.slice(6, 8), 10);
    const h = parseInt(input.slice(8, 10), 10);
    const min = parseInt(input.slice(10, 12), 10);
    const s = parseInt(input.slice(12, 14), 10);
    return new Date(Date.UTC(y, m, d, h, min, s));
  }
  // Try parsing as YYYYMMDD
  if (/^\d{8}$/.test(input.trim())) {
    const y = parseInt(input.slice(0, 4), 10);
    const m = parseInt(input.slice(4, 6), 10) - 1;
    const d = parseInt(input.slice(6, 8), 10);
    return new Date(Date.UTC(y, m, d));
  }
  // Try parsing as ISO or other date string
  const d = new Date(input);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function getTimeDiff(from: Date, to: Date) {
  return (to.getTime() - from.getTime()) / 1000;
}

function pickUnit(seconds: number, magnitude?: string, minMagnitude?: string) {
  let units = TIME_UNITS;
  if (magnitude) {
    const idx = units.findIndex(
      (u) =>
        u.key === magnitude ||
        u.singular === magnitude ||
        u.plural === magnitude
    );
    if (idx !== -1) units = [units[idx]];
  }
  if (minMagnitude) {
    const idx = units.findIndex(
      (u) =>
        u.key === minMagnitude ||
        u.singular === minMagnitude ||
        u.plural === minMagnitude
    );
    if (idx !== -1) units = units.slice(0, idx + 1);
  }
  for (const unit of units) {
    if (Math.abs(seconds) >= unit.seconds || unit.seconds === 1) {
      return unit;
    }
  }
  return units[units.length - 1];
}

/** TimeAgo template */
export function TimeAgo({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  const params = templateToObject(node);
  const timestamp = params["1"];
  const magnitude = params["magnitude"];
  const minMagnitude = params["min_magnitude"];
  const agoParam = params["ago"];
  const spellout = params["spellout"];
  const spelloutmax = params["spelloutmax"]
    ? parseInt(params["spelloutmax"])
    : undefined;
  const numeric = params["numeric"];
  const purge = params["purge"];

  const now = new Date();
  const date = parseDate(timestamp);
  if (!date) {
    return (
      <strong className="error">
        Error: first parameter cannot be parsed as a date or time.
      </strong>
    );
  }
  let diff = getTimeDiff(date, now);
  let isFuture = false;
  if (diff < 0) {
    isFuture = true;
    diff = -diff;
  }
  const unit = pickUnit(diff, magnitude, minMagnitude);
  const value = Math.floor(diff / unit.seconds);

  // Spellout logic
  let valueText = value.toString();
  if (spellout) {
    if (
      (spellout === "auto" &&
        value >= 1 &&
        value <= 9 &&
        (!spelloutmax || value <= spelloutmax)) ||
      ((spellout === "yes" ||
        spellout === "y" ||
        spellout === "true" ||
        spellout === "1") &&
        value >= 1 &&
        value <= 100 &&
        (!spelloutmax || value <= spelloutmax))
    ) {
      valueText = numberToWords(value);
    }
  }

  // Numeric only
  if (
    numeric === "y" ||
    numeric === "yes" ||
    numeric === "true" ||
    numeric === "1"
  ) {
    return <>{value}</>;
  }

  // Suffix logic
  let suffix = "";
  if (isFuture) {
    suffix = agoParam === "" ? "" : " time";
  } else {
    suffix = agoParam === "" ? "" : ` ${agoParam || "ago"}`;
  }

  // Pluralization
  const unitText = value === 1 ? unit.singular : unit.plural;
  let result = `${valueText} ${unitText}${suffix}`;

  // Purge link (not functional, just for display)
  if (purge && purge.toLowerCase() === "yes") {
    result += " (purge)";
  }

  return <>{result}</>;
}
