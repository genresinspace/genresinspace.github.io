import { useDataContext } from "../../../data";

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
export const wikiUrl = (domain: string): string => `https://${domain}/wiki`;

/**
 * Constructs the full Wikipedia page URL from a base wiki URL and page title
 * @param wikiUrl - The base Wikipedia URL (e.g. "https://en.wikipedia.org/wiki")
 * @param pageTitle - The title of the Wikipedia page
 * @returns The full Wikipedia page URL with spaces replaced by underscores
 */
export const wikiPageUrl = (wikiUrl: string, pageTitle: string): string =>
  `${wikiUrl}/${pageTitle.replace(/ /g, "_")}`;

/**
 * Constructs a redirect URL for a Wikimedia Commons asset.
 * @param filename The filename of the asset.
 * @returns A redirect URL for the asset.
 */
export const wikimediaCommmonsAssetUrl = (filename: string) =>
  `https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/${filename}`;

/**
 * React hook that returns the base Wikipedia URL using the domain from context
 * @returns The base Wikipedia URL or null if no domain is found in context
 */
export const useWikiUrl = () => {
  const { wikipedia_domain: domain } = useDataContext();
  if (!domain) {
    return null;
  }
  return wikiUrl(domain);
};
