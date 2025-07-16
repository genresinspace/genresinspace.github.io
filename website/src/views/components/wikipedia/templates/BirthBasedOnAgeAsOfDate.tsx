import { WikitextSimplifiedNode } from "frontend_wasm";
import { templateToObject } from "./util";

/**
 * Renders a birth date range based on age at a specific date.
 * {{Birth based on age as of date|age|year|month|day}}
 * {{Birth based on age as of date|age|date}}
 * e.g. {{Birth based on age as of date|52|2012|4|25}} -> (1959-04-26 to 1960-04-25)
 * e.g. {{Birth based on age as of date|52|2012}} -> c. 1960
 */
export function BirthBasedOnAgeAsOfDate({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  const params = templateToObject(node);

  const age = parseInt(params["1"]);
  if (isNaN(age)) {
    return <span>Error: Invalid age</span>;
  }

  const yearStr = params["2"];
  const monthStr = params["3"];
  const dayStr = params["4"];

  let asOfYear: number, asOfMonth: number | undefined, asOfDay: number | undefined;

  if (monthStr !== undefined) {
    // Format: |age|year|month|day
    asOfYear = parseInt(yearStr);
    asOfMonth = parseInt(monthStr);
    asOfDay = parseInt(dayStr);
  } else {
    // Format: |age|date
    // Try parsing as just a year first.
    const yearNum = parseInt(yearStr);
    if (!isNaN(yearNum) && /^\d{4}$/.test(yearStr.trim())) {
      asOfYear = yearNum;
    } else {
      // Try parsing as a full date string
      const date = new Date(yearStr);
      if (!isNaN(date.getTime())) {
        asOfYear = date.getUTCFullYear();
        asOfMonth = date.getUTCMonth() + 1;
        asOfDay = date.getUTCDate();
      } else {
        return <span>Error: Invalid date format in parameter 2</span>;
      }
    }
  }

  if (isNaN(asOfYear)) {
    return <span>Error: Invalid year</span>;
  }

  if (
    asOfMonth === undefined ||
    asOfDay === undefined ||
    isNaN(asOfMonth) ||
    isNaN(asOfDay)
  ) {
    const birthYear = asOfYear - age;
    return <>c. {birthYear}</>;
  }

  // Using UTC to avoid timezone issues.
  const latestBday = new Date(Date.UTC(asOfYear - age, asOfMonth - 1, asOfDay));
  const earliestBday = new Date(
    Date.UTC(asOfYear - age - 1, asOfMonth - 1, asOfDay + 1)
  );

  const formatDate = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <>({formatDate(earliestBday)} to {formatDate(latestBday)})</>
  );
}
