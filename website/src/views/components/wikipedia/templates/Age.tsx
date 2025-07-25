import { WikitextSimplifiedNode } from "frontend_wasm";
import { templateToObject } from "./util";
import { numberToOrdinal, numberToWords } from "../../../../util/numberToWords";

/**
 * Renders the age template.
 *
 * Calculates the number of full years between two dates.
 * If only one date is provided, calculates years from that date to today.
 *
 * Usage: {{age|year|month|day|year2|month2|day2}} or {{age|year|month|day}}
 * Examples:
 * - {{age|1989|7|23|2003|7|14}} → 13
 * - {{age|1989|7|23}} → 35 (from today)
 * - {{age|1989|7|0|2003|7|14}} → 13–14 (partial date)
 */
export function Age({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  const params = templateToObject(node);

  // Extract parameters
  const year1 = parseInt(params["1"] || params["year"]);
  const month1 = parseInt(params["2"] || params["month"]);
  const day1 = parseInt(params["3"] || params["day"]);
  const year2 = parseInt(params["4"] || params["year2"]);
  const month2 = parseInt(params["5"] || params["month2"]);
  const day2 = parseInt(params["6"] || params["day2"]);
  const format = params["format"];

  // Validate required parameters
  if (!year1 || isNaN(year1)) {
    return <span>Error: First date should be year, month, day</span>;
  }

  // If second date is not provided, use current date
  let endYear = year2;
  let endMonth = month2;
  let endDay = day2;

  if (!endYear || isNaN(endYear)) {
    const now = new Date();
    endYear = now.getFullYear();
    endMonth = now.getMonth() + 1; // getMonth() returns 0-11
    endDay = now.getDate();
  }

  // Validate dates
  if (!isValidDate(year1, month1, day1)) {
    return <span>Error: First date should be year, month, day</span>;
  }
  if (!isValidDate(endYear, endMonth, endDay)) {
    return <span>Error: Second date should be year, month, day</span>;
  }

  // Calculate age
  const age = calculateAge(year1, month1, day1, endYear, endMonth, endDay);

  // Format the result
  const result = formatAge(age, format);

  // If only one date was provided, add the special span class
  if (!year2 || isNaN(year2)) {
    return (
      <span>
        <span className="currentage"></span>
        {result}
      </span>
    );
  }

  return <span>{result}</span>;
}

/**
 * Validates if a date is valid
 */
function isValidDate(year: number, month: number, day: number): boolean {
  // Handle partial dates (0 for missing month/day)
  if (month === 0) month = 1;
  if (day === 0) day = 1;

  // Basic validation
  if (year < -9999 || year > 9999) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // Check for valid date (handles leap years, etc.)
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Calculates the age between two dates
 */
function calculateAge(
  year1: number,
  month1: number,
  day1: number,
  year2: number,
  month2: number,
  day2: number
): number {
  // Handle partial dates
  const startMonth = month1 === 0 ? 1 : month1;
  const startDay = day1 === 0 ? 1 : day1;
  const endMonth = month2 === 0 ? 1 : month2;
  const endDay = day2 === 0 ? 1 : day2;

  const startDate = new Date(year1, startMonth - 1, startDay);
  const endDate = new Date(year2, endMonth - 1, endDay);

  // Calculate difference in years
  let age = endDate.getFullYear() - startDate.getFullYear();

  // Adjust if birthday hasn't occurred yet in the end year
  if (
    endDate.getMonth() < startDate.getMonth() ||
    (endDate.getMonth() === startDate.getMonth() &&
      endDate.getDate() < startDate.getDate())
  ) {
    age--;
  }

  return age;
}

/**
 * Formats the age according to the specified format
 */
function formatAge(age: number, format?: string): string {
  switch (format) {
    case "commas":
      return age.toLocaleString();
    case "cardinal":
      return numberToWords(age);
    case "ordinal":
      return numberToOrdinal(age);
    case "raw":
    default:
      return age.toString();
  }
}
