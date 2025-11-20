import { WikitextSimplifiedNode } from "frontend_wasm";
import { templateToObject } from "./util";

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Renders a birth date, including hidden metadata for machines.
 * {{Birth date|year|month|day|df=y}}
 * e.g. {{Birth date|1993|2|24}} -> February 24, 1993
 * e.g. {{Birth date|1993|2|24|df=y}} -> 24 February 1993
 */
export function BirthDate({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  const params = templateToObject(node);

  const year = parseInt(params["1"]);
  const month = parseInt(params["2"]);
  const day = parseInt(params["3"]);
  const df = params["df"]?.toLowerCase();

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    const parts = [params["1"], params["2"], params["3"]]
      .filter((p) => p)
      .join(" ");
    return <span>{parts}</span>;
  }

  const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const monthName = monthNames[month - 1];

  const dayFirst = df === "y" || df === "yes" || df === "1" || df === "true";

  let formattedDate: string;
  if (dayFirst) {
    formattedDate = `${day} ${monthName} ${year}`;
  } else {
    formattedDate = `${monthName} ${day}, ${year}`;
  }

  return (
    <>
      {formattedDate}
      <span style={{ display: "none" }}>
        {" "}
        (<span className="bday">{isoDate}</span>)
      </span>
    </>
  );
}
