import { createContext, useContext, useEffect, useState } from "react";
import { page_name_to_filename } from "frontend_wasm";
import { GenreFileData } from "../data";

/**
 * A cache for genre data.
 */
export class GenreCache {
  private cache: Map<string, Promise<GenreFileData | null>> = new Map();

  get(genrePage: string): Promise<GenreFileData | null> {
    if (!this.cache.has(genrePage)) {
      this.cache.set(genrePage, fetchGenreData(genrePage));
    }
    return this.cache.get(genrePage)!;
  }
}

async function fetchGenreData(
  genrePage: string
): Promise<GenreFileData | null> {
  try {
    const filename = page_name_to_filename(genrePage);
    const response = await fetch(`/genres/${filename}.json`);
    if (response.ok) {
      return await response.json();
    } else {
      throw new Error(response.statusText);
    }
  } catch (error) {
    console.error(`Failed to fetch genre data for ${genrePage}:`, error);
    return null;
  }
}

/**
 * The React context for the genre cache.
 */
export const GenreCacheContext = createContext<GenreCache | null>(null);

/**
 * A hook to access the genre cache.
 * @returns The genre cache.
 */
const useGenreCache = () => {
  const context = useContext(GenreCacheContext);
  if (!context) {
    throw new Error("useGenreCache must be used within an GenreCacheProvider");
  }
  return context;
};

/**
 * A hook to get the genre data for a given genre page.
 *
 * Will fetch the genre data if it is not already in the cache.
 * @param genrePage The page name of the genre.
 * @returns The genre data.
 */
export const useGenre = (genrePage: string | null): GenreFileData | null => {
  const genreCache = useGenreCache();
  const [genre, setGenre] = useState<GenreFileData | null>(null);
  useEffect(() => {
    if (!genrePage) return;
    setGenre(null);
    genreCache.get(genrePage).then(setGenre);
  }, [genrePage]);
  return genre;
};
