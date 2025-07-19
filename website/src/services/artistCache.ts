import { createContext, useContext, useEffect, useState } from "react";
import { page_name_to_filename } from "frontend_wasm";
import { ArtistFileData } from "../data";

/**
 * A cache for artist data.
 */
export class ArtistCache {
  private cache: Map<string, Promise<ArtistFileData | null>> = new Map();

  get(artistPage: string): Promise<ArtistFileData | null> {
    if (!this.cache.has(artistPage)) {
      this.cache.set(artistPage, fetchArtistData(artistPage));
    }
    return this.cache.get(artistPage)!;
  }
}

async function fetchArtistData(
  artistPage: string
): Promise<ArtistFileData | null> {
  try {
    const filename = page_name_to_filename(artistPage);
    const response = await fetch(`/artists/${filename}.json`);
    if (response.ok) {
      return await response.json();
    } else {
      throw new Error(response.statusText);
    }
  } catch (error) {
    console.error(`Failed to fetch artist data for ${artistPage}:`, error);
    return null;
  }
}

/**
 * The React context for the artist cache.
 */
export const ArtistCacheContext = createContext<ArtistCache | null>(null);

/**
 * A hook to access the artist cache.
 * @returns The artist cache.
 */
const useArtistCache = () => {
  const context = useContext(ArtistCacheContext);
  if (!context) {
    throw new Error(
      "useArtistCache must be used within an ArtistCacheProvider"
    );
  }
  return context;
};

/**
 * A hook to get the artist data for a given artist page.
 *
 * Will fetch the artist data if it is not already in the cache.
 * @param artistPage The page name of the artist.
 * @returns The artist data.
 */
export const useArtist = (artistPage: string | null): ArtistFileData | null => {
  const artistCache = useArtistCache();
  const [artist, setArtist] = useState<ArtistFileData | null>(null);
  useEffect(() => {
    if (!artistPage) return;
    artistCache.get(artistPage).then(setArtist);
  }, [artistPage]);
  return artist;
};
