import { WikitextSimplifiedNode } from "frontend_wasm";
import { templateToObject } from "./util";

export function Height({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  const params = templateToObject(node);

  const ft = parseFloat(
    params["ft"] || params["foot"] || params["feet"] || ""
  );
  const inches = parseFloat(
    params["in"] || params["inch"] || params["inches"] || ""
  );
  const m = parseFloat(
    params["m"] ||
      params["meter"] ||
      params["metre"] ||
      params["meters"] ||
      params["metres"] ||
      ""
  );
  const cm = parseFloat(
    params["cm"] ||
      params["centimeter"] ||
      params["centimetre"] ||
      params["centimeters"] ||
      params["centimetres"] ||
      ""
  );

  // Imperial provided
  if (!isNaN(ft) || !isNaN(inches)) {
    const totalInches = (isNaN(ft) ? 0 : ft * 12) + (isNaN(inches) ? 0 : inches);
    const meters = totalInches * 0.0254;
    const feetPart = !isNaN(ft) ? `${ft} ft` : "";
    const inchPart = !isNaN(inches) ? `${inches} in` : "";
    const sep = feetPart && inchPart ? " " : "";
    return (
      <>
        {feetPart}
        {sep}
        {inchPart} ({meters.toFixed(2)}&nbsp;m)
      </>
    );
  }

  // Centimeters provided
  if (!isNaN(cm)) {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const remainingInches = Math.round(totalInches % 12);
    return (
      <>
        {cm}&nbsp;cm ({feet}&nbsp;ft {remainingInches}&nbsp;in)
      </>
    );
  }

  // Meters provided
  if (!isNaN(m)) {
    const totalInches = m / 0.0254;
    const feet = Math.floor(totalInches / 12);
    const remainingInches = Math.round(totalInches % 12);
    return (
      <>
        {m}&nbsp;m ({feet}&nbsp;ft {remainingInches}&nbsp;in)
      </>
    );
  }

  return null;
}
