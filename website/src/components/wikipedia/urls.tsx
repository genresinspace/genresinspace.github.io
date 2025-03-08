import { createContext, useContext } from "react";

export const WikipediaMetaContext = createContext<{
  dbName: string;
  domain: string;
} | null>(null);

/**
 * @param {string} dumpDate - The date of the Wikipedia dump in YYYY-MM-DD format
 * @returns {string} URL to the Wikipedia dump directory
 */
export const dumpUrl = (databaseName: string, dumpDate: string): string =>
  `https://dumps.wikimedia.org/${databaseName}/${dumpDate
    .split("-")
    .join("")}/`;

/**
 * Constructs the base Wikipedia URL for a given domain
 * @param domain - The Wikipedia domain (e.g. "en.wikipedia.org")
 * @returns The base Wikipedia URL (e.g. "https://en.wikipedia.org/wiki")
 */
export function wikiUrl(domain: string): string {
  return `https://${domain}/wiki`;
}

/**
 * Constructs the full Wikipedia page URL from a base wiki URL and page title
 * @param wikiUrl - The base Wikipedia URL (e.g. "https://en.wikipedia.org/wiki")
 * @param pageTitle - The title of the Wikipedia page
 * @returns The full Wikipedia page URL with spaces replaced by underscores
 */
export function wikiPageUrl(wikiUrl: string, pageTitle: string): string {
  return `${wikiUrl}/${pageTitle.replace(/ /g, "_")}`;
}

/**
 * React hook that returns the base Wikipedia URL using the domain from context
 * @returns The base Wikipedia URL or null if no domain is found in context
 */
export const useWikiUrl = () => {
  const meta = useContext(WikipediaMetaContext);
  if (!meta) {
    return null;
  }
  return wikiUrl(meta.domain);
};
