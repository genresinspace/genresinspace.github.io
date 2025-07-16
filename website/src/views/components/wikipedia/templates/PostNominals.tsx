import { WikitextSimplifiedNode } from "frontend_wasm";
import { templateToObject } from "./util";
import { WikipediaMaybeGenreLink } from "../links/WikipediaMaybeGenreLink";
import { Wikitext } from "../wikitexts/Wikitext";

/**
 * Renders the post-nominals template.
 *
 * Formats post-nominal letters (academic degrees, professional qualifications, etc.)
 * with proper linking and formatting according to the Wikipedia template specification.
 *
 * Supports parameters:
 * - country: ISO 3166-1 alpha-3 country code (default: CAN)
 * - size: Font size as percentage (default: 85%)
 * - sep/commas: Separator between post-nominals (default: space)
 * - unlinked/list/post-noms: Custom linking or unlinked display
 * - numbered parameters (1-20) for post-nominals
 *
 * Usage: {{post-nominals|country=GBR|size=100%|sep=,|PC|CC|OBE}}
 * Examples:
 * - {{post-nominals|PC|CC|OBE}} → PC CC OBE (Canadian honours)
 * - {{post-nominals|country=GBR|PC|CC|OBE}} → PC CC OBE (British honours)
 * - {{post-nominals|unlinked=PC CC OBE}} → PC CC OBE (no links)
 */
export function PostNominals({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  const params = templateToObject(node);

  // Extract parameters
  const country = params["country"] || "CAN"; // default to Canadian honours
  const size = params["size"] || "85%";
  const separator = params["sep"] || params["commas"] || " ";
  const unlinked = params["unlinked"];
  const list = params["list"] || params["post-noms"];

  // Handle unlinked or custom linked display
  if (unlinked) {
    return <span style={{ fontSize: size }}>{unlinked}</span>;
  }

  if (list) {
    return (
      <span style={{ fontSize: size }}>
        <Wikitext wikitext={list} />
      </span>
    );
  }

  // Collect numbered parameters (1-20)
  const postNominals: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const param = params[i.toString()];
    if (param && param.trim()) {
      postNominals.push(param.trim());
    }
  }

  if (postNominals.length === 0) {
    return null;
  }

  // Render post-nominals with appropriate linking
  const renderPostNominal = (nominal: string) => {
    // Handle special cases and exceptions from the documentation
    if (nominal.endsWith("f")) {
      // Dame version (remove 'f' suffix for display)
      const displayNominal = nominal.slice(0, -1);
      return (
        <WikipediaMaybeGenreLink pageTitle={`${displayNominal} (honorific)`}>
          {displayNominal}
        </WikipediaMaybeGenreLink>
      );
    }

    if (nominal.endsWith("d")) {
      // Distinguished service version
      const displayNominal = nominal.slice(0, -1);
      return (
        <WikipediaMaybeGenreLink
          pageTitle={`${displayNominal} (distinguished service)`}
        >
          {displayNominal}
        </WikipediaMaybeGenreLink>
      );
    }

    if (nominal.endsWith("l")) {
      // London Assembly version
      const displayNominal = nominal.slice(0, -1);
      return (
        <WikipediaMaybeGenreLink
          pageTitle={`${displayNominal} (London Assembly)`}
        >
          {displayNominal}
        </WikipediaMaybeGenreLink>
      );
    }

    if (nominal.endsWith("w")) {
      // Wales Assembly version
      const displayNominal = nominal.slice(0, -1);
      return (
        <WikipediaMaybeGenreLink
          pageTitle={`${displayNominal} (Wales Assembly)`}
        >
          {displayNominal}
        </WikipediaMaybeGenreLink>
      );
    }

    if (nominal.endsWith("h")) {
      // Honorary version
      const displayNominal = nominal.slice(0, -1);
      return (
        <WikipediaMaybeGenreLink pageTitle={`${displayNominal} (honorary)`}>
          {displayNominal}
        </WikipediaMaybeGenreLink>
      );
    }

    if (nominal.endsWith("t")) {
      // Order of Merit version
      const displayNominal = nominal.slice(0, -1);
      return (
        <WikipediaMaybeGenreLink
          pageTitle={`${displayNominal} (Order of Merit)`}
        >
          {displayNominal}
        </WikipediaMaybeGenreLink>
      );
    }

    // Default linking based on country
    const countryPrefix =
      country === "CAN"
        ? "Canadian "
        : country === "GBR"
          ? "British "
          : country === "AUS"
            ? "Australian "
            : country === "NZL"
              ? "New Zealand "
              : "";

    return (
      <WikipediaMaybeGenreLink pageTitle={`${countryPrefix}${nominal}`}>
        {nominal}
      </WikipediaMaybeGenreLink>
    );
  };

  // Join with appropriate separator
  const formattedNominals = postNominals.map((nominal, index) => (
    <span key={index}>
      {renderPostNominal(nominal)}
      {index < postNominals.length - 1 && separator}
    </span>
  ));

  return <span style={{ fontSize: size }}>{formattedNominals}</span>;
}
