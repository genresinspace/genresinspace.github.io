import { WikitextSimplifiedNode } from "frontend_wasm";
import { templateToObject } from "./util";

/**
 * Renders the as_of template.
 *
 * Supports all parameters from the Wikipedia template:
 * - year, month, day: Date components
 * - df: Date format (mdy, US, us for month-day-year format)
 * - lc: Lowercase flag (any value makes first letter lowercase)
 * - alt: Alternative text to replace "As of [date]"
 * - since: Replace "As of" with "Since" (any value)
 * - url: Hidden URL for future updates (shows as [ref] if CSS enabled)
 * - pre: Text to add before the date
 * - post: Text to add after the date (usually punctuation)
 * - bare: Display only the date with no accompanying text
 */
export function AsOf({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  const params = templateToObject(node);

  // Extract parameters
  const year = params["1"] || params["year"];
  const month = params["2"] || params["month"];
  const day = params["3"] || params["day"];
  const df = params["df"];
  const lc = params["lc"];
  const alt = params["alt"];
  const since = params["since"];
  const url = params["url"];
  const pre = params["pre"];
  const post = params["post"];
  const bare = params["bare"];

  // Build the date string
  let dateParts: string[] = [];

  if (month) {
    dateParts.push(month);
  }
  if (day) {
    dateParts.push(day);
  }
  if (year) {
    dateParts.push(year);
  }

  let dateString = dateParts.join(" ");

  // Apply date format if specified
  if (
    df &&
    (df === "mdy" || df === "US" || df === "us") &&
    month &&
    day &&
    year
  ) {
    // For US format, we'd typically show "Month Day, Year" but we'll keep it simple
    dateString = `${month} ${day}, ${year}`;
  }

  // Add pre-text if specified
  if (pre) {
    dateString = `${pre} ${dateString}`;
  }

  // Add post-text if specified
  if (post) {
    dateString = `${dateString}${post}`;
  }

  // Determine the prefix text
  let prefix = "As of";
  if (since) {
    prefix = "Since";
  }
  if (lc) {
    prefix = prefix.toLowerCase();
  }

  // Use alternative text if provided
  if (alt) {
    prefix = alt;
  }

  // If bare is specified, return only the date
  if (bare) {
    return <span>{dateString}</span>;
  }

  // Build the final text
  let displayText = `${prefix} ${dateString}`;

  return (
    <span>
      {displayText}
      {url && (
        <sup>
          <a href={url} target="_blank" rel="noopener noreferrer">
            [ref]
          </a>
        </sup>
      )}
    </span>
  );
}
