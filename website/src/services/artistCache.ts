import { createContext, useContext } from "react";
import { page_name_to_filename } from "frontend_wasm";
import { ArtistData } from "../data";

/**
 * A cache for artist data.
 */
export class ArtistCache {
  private cache: Map<string, Promise<ArtistData | null>> = new Map();

  get(artistPage: string): Promise<ArtistData | null> {
    if (!this.cache.has(artistPage)) {
      this.cache.set(artistPage, fetchArtistData(artistPage));
    }
    return this.cache.get(artistPage)!;
  }
}

async function fetchArtistData(artistPage: string): Promise<ArtistData | null> {
  try {
    const filename = page_name_to_filename(artistPage);
    const response = await fetch(`/artists/${filename}.json`);
    if (response.ok) {
      const data: ArtistData = await response.json();
      return data;
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch artist data:", error);
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
export const useArtistCache = () => {
  const context = useContext(ArtistCacheContext);
  if (!context) {
    throw new Error(
      "useArtistCache must be used within an ArtistCacheProvider"
    );
  }
  return context;
};
