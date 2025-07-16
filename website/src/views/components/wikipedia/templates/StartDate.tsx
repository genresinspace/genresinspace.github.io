import { WikitextSimplifiedNode } from "frontend_wasm";
import { templateToObject } from "./util";

/**
 * Renders a start date, including hidden metadata for machines.
 * {{Start date|year|month|day|hour|minute|second|df=y}}
 */
export function StartDate({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  const params = templateToObject(node);

  const year = parseInt(params["1"]);
  const month = parseInt(params["2"]);
  const day = parseInt(params["3"]);
  const hour = parseInt(params["4"]);
  const minute = parseInt(params["5"]);
  const second = parseInt(params["6"]);

  if (isNaN(year)) {
    return <span>Invalid date</span>;
  }

  const date = new Date(Date.UTC(year, month ? month - 1 : 0, day || 1, hour || 0, minute || 0, second || 0));

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    timeZone: 'UTC',
  };
  if (!isNaN(month)) {
    options.month = 'long';
  }
  if (!isNaN(day)) {
    options.day = 'numeric';
  }
  if (!isNaN(hour)) {
    options.hour = 'numeric';
  }
  if (!isNaN(minute)) {
    options.minute = 'numeric';
  }
  if (!isNaN(second)) {
    options.second = 'numeric';
  }

  const formattedDate = date.toLocaleDateString(undefined, options);

  return (
    <time dateTime={date.toISOString()}>
      {formattedDate}
    </time>
  );
}