import { createContext, useContext, useEffect, useState } from "react";
import { page_name_to_filename } from "frontend_wasm";
import { ArtistFileData, GenreFileData } from "../data";

/**
 * A cache for data.
 */
export class DataCache {
  private cache: Map<string, Map<string, unknown>> = new Map();

  constructor() {
    this.cache.set("artists", new Map());
    this.cache.set("genres", new Map());
  }

  async get<T>(
    directory: "artists" | "genres",
    page: string
  ): Promise<T | null> {
    const directoryCache = this.cache.get(directory)!;
    if (!directoryCache.has(page)) {
      directoryCache.set(page, await fetchDatum(directory, page));
    }
    return directoryCache.get(page) as T | null;
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
    throw new Error("useDataCache must be used within a DataCacheProvider");
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
