import { createContext, useContext, useEffect, useState } from "react";
import { page_name_to_filename } from "frontend_wasm";
import { ArtistFileData, GenreFileData, LinksToPageIds } from "../data";

/**
 * A cache for data.
 */
export class DataCache {
  private cache: Map<string, Map<string, unknown | Promise<unknown>>> =
    new Map();
  private linksToPageIds: LinksToPageIds | Promise<LinksToPageIds> | null =
    null;

  constructor() {
    this.cache.set("artists", new Map());
    this.cache.set("genres", new Map());
  }

  async get<T>(
    directory: "artists" | "genres",
    page: string
  ): Promise<T | null> {
    const directoryCache = this.cache.get(directory)!;
    const cached = directoryCache.get(page);

    // If we have a cached value (not a promise), return it
    if (cached && !(cached instanceof Promise)) {
      return cached as T | null;
    }

    // If we have a promise in flight, wait for it
    if (cached instanceof Promise) {
      const result = await cached;
      return result as T | null;
    }

    // No cached value or promise, start a new request
    const requestPromise = fetchDatum(directory, page).then((result) => {
      // Replace the promise with the actual result
      directoryCache.set(page, result);
      return result;
    });

    // Store the promise in the cache
    directoryCache.set(page, requestPromise);

    return (await requestPromise) as T | null;
  }

  /**
   * Get the links to page IDs.
   * @returns The links to page IDs.
   */
  async getLinksToPageIds(): Promise<LinksToPageIds> {
    // If we have a cached value (not a promise), return it
    if (this.linksToPageIds && !(this.linksToPageIds instanceof Promise)) {
      return this.linksToPageIds;
    }

    // If we have a promise in flight, wait for it
    if (this.linksToPageIds instanceof Promise) {
      return await this.linksToPageIds;
    }

    // No cached value or promise, start a new request
    const requestPromise = fetch("/links_to_page_ids.json")
      .then(async (response) => {
        if (response.ok) {
          const result = await response.json();
          // Replace the promise with the actual result
          this.linksToPageIds = result;
          return result;
        } else {
          throw new Error(response.statusText);
        }
      })
      .catch((error) => {
        console.error("Failed to fetch links to page IDs:", error);
        throw error;
      });

    // Store the promise in the cache
    this.linksToPageIds = requestPromise;

    return await requestPromise;
  }
}

async function fetchDatum<T>(
  directory: string,
  page: string
): Promise<T | null> {
  try {
    const filename = page_name_to_filename(page);
    const response = await fetch(`/${directory}/${filename}.json`);
    if (response.ok) {
      return await response.json();
    } else {
      throw new Error(response.statusText);
    }
  } catch (error) {
    console.error(`Failed to fetch ${directory} data for ${page}:`, error);
    return null;
  }
}

/**
 * The React context for the cache.
 */
export const DataCacheContext = createContext<DataCache | null>(null);

/**
 * A hook to get the data for a given page.
 * @param directory The directory to get the data from.
 * @param page The page to get the data for.
 * @returns The data.
 */
const useDatum = <T>(
  directory: "artists" | "genres",
  page: string | null
): T | null => {
  const context = useContext(DataCacheContext);
  const [datum, setDatum] = useState<T | null>(null);
  if (!context) {
    throw new Error("useDatum must be used within a DataCacheProvider");
  }
  useEffect(() => {
    if (!page) return;
    setDatum(null);
    context.get(directory, page).then((datum) => setDatum(datum as T | null));
  }, [page]);
  return datum;
};

/**
 * A hook to get the genre data for a given genre page.
 *
 * Will fetch the genre data if it is not already in the cache.
 * @param genrePage The page name of the genre.
 * @returns The genre data.
 */
export const useGenre = (genrePage: string | null): GenreFileData | null => {
  return useDatum("genres", genrePage);
};

/**
 * A hook to get the artist data for a given artist page.
 *
 * Will fetch the artist data if it is not already in the cache.
 * @param artistPage The page name of the artist.
 * @returns The artist data.
 */
export const useArtist = (artistPage: string | null): ArtistFileData | null => {
  return useDatum("artists", artistPage);
};

/**
 * A hook to get the links to page IDs.
 * @returns The links to page IDs.
 */
export const useLinksToPageIds = (): LinksToPageIds | null => {
  const context = useContext(DataCacheContext);
  const [linksToPageIds, setLinksToPageIds] = useState<LinksToPageIds | null>(
    null
  );
  if (!context) {
    throw new Error(
      "useLinksToPageIds must be used within a DataCacheProvider"
    );
  }
  useEffect(() => {
    context
      .getLinksToPageIds()
      .then((linksToPageIds) => setLinksToPageIds(linksToPageIds));
  }, []);
  return linksToPageIds;
};
