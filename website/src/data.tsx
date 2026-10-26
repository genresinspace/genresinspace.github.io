import { createContext, useContext } from "react";

import {
  oklchCss,
  oklchToRgb,
  readColourToken,
  relativeLuminance,
} from "./util/colour";

/** The data that is identical between {@link DataOnDisk} and {@link Data}. */
export type DataShared = {
  /** The Wikipedia domain. */
  wikipedia_domain: string;
  /** The Wikipedia database name. */
  wikipedia_db_name: string;
  /** The date of the dump (ISO 8601). */
  dump_date: string;
  /** The maximum degree of any node in the graph. */
  max_degree: number;
};

/** The raw data that we load from the network. */
export type DataOnDisk = DataShared & {
  /** The nodes in the graph. */
  nodes: NodeOnDiskData[];
  /** The edges in the graph. */
  edges: EdgeOnDiskData[];
};

/** The global data made available to the frontend after {@link DataOnDisk} is post-processed by {@link postProcessData}. */
export type Data = DataShared & {
  /** The nodes in the graph. */
  nodes: NodeData[];
  /** The edges in the graph. */
  edges: EdgeData[];
};

/** Global context for the data. */
export const DataContext = createContext<Data | null>(null);
/** Hook to get the global graph data ({@link Data}).
 *
 * This assumes the data has already been provided; the result is empty if not. */
export const useDataContext = () => useContext(DataContext) || ({} as Data);

/** Post-process the raw data sent to us to make it acceptable for the rest of the frontend. */
export function postProcessData(data: DataOnDisk): Data {
  const newData: Data = {
    ...data,
    edges: data.edges.map((edge) => ({
      source: edge[0].toString(),
      target: edge[1].toString(),
      ty: edge[2],
    })),
    nodes: data.nodes.map((node, index) => ({
      id: index.toString(),
      edges: [],
      ...node,
    })),
  };

  for (const [index, edge] of data.edges.entries()) {
    const source = newData.nodes[edge[0]];
    source.edges.push(index);

    const target = newData.nodes[edge[1]];
    target.edges.push(index);
  }

  return newData;
}

/** A node in the graph, as stored on disk. */
export type NodeOnDiskData = {
  /** The node's Wikipedia page title. When not present, the same as {@link label}. */
  page_title?: string;
  /** The node's label. */
  label: string;
  /** Alternative names, derived from Wikipedia redirects. Absent in older data. */
  aliases?: string[];
  /** Inbound Wikipedia link count for the genre's page. Absent in older data. */
  links?: number;
  /** The node's precomputed x position from force-directed layout. */
  x: number;
  /** The node's precomputed y position from force-directed layout. */
  y: number;
  /** The node's precomputed hue (0–360) from color propagation. */
  hue: number;
};

/** A node in the graph. */
export type NodeData = NodeOnDiskData & {
  /** The node's ID (integer as a string). Consider using {@link nodeIdToInt} instead. */
  id: string;
  /** The node's edges. */
  edges: number[];
};
/** Convert a node ID (integer as a string) to an integer. */
export const nodeIdToInt = (id: string) => parseInt(id, 10);
/** Get the page title of a node. */
export const nodePageTitle = (data: NodeData) => data.page_title ?? data.label;

/** Genre data from the genre JSON files. */
export type GenreFileData = {
  /** The genre's Wikipedia wikitext description. */
  description?: string;
  /** The node's last revision date (ISO 8601). */
  last_revision_date: string;
  /** The node's mixes. */
  mixes?:
    | { help_reason: string | null }
    | { playlist: string; note?: string }[]
    | { video: string; note?: string }[];
  /** The node's top artists, as page names. */
  top_artists: string[];
};

/** A map of links to page IDs. */
export type LinksToPageIds = Record<string, number>;

/** Values for node colour lightness in different contexts, as OKLCH
 *  lightness percentages. Solid fills sit at `Background`, which is dark
 *  enough to carry white text for every hue. */
export const NodeColourLightness = {
  /** The lightness of the darker background colour. */
  DarkerBackground: 24,
  /** The lightness of the background colour. */
  Background: 42,
  /** The lightness of a hovered background colour. */
  HoveredBackground: 48,
  /** The lightness of the graph node's colour. */
  GraphNode: 66,
  /** The lightness of the graph label's background colour. */
  GraphLabelBackground: 20,
  /** The lightness of the graph label's background border colour. */
  GraphLabelBackgroundBorder: 38,
  /** The lightness of the graph label's text colour. */
  GraphLabelText: 86,
  /** The lightness of a link's text colour. */
  LinkText: 74,
  /** The lightness of a link's text colour when hovered. */
  LinkTextHover: 82,
} as const;

/** Hook returning node colour lightness values (kept as a hook for API compatibility). */
export function useNodeColourLightness() {
  return NodeColourLightness;
}

/** A node's chroma: mostly degree, with every genre keeping a floor of colour
 *  so that obscure nodes still read as their own hue. `saturationBoost` is a
 *  percentage lift on top, for contexts that want a stronger tint. */
function nodeChroma(
  node: NodeData,
  maxDegree: number,
  saturationBoost: number = 0
): number {
  const degreeFraction =
    maxDegree > 0 ? Math.min(1, node.edges.length / maxDegree) : 0;
  return (0.04 + degreeFraction * 0.085) * (1 + saturationBoost / 100);
}

/** Given a node, calculate its colour, factoring in degree and lightness. */
export function nodeColour(
  node: NodeData,
  maxDegree: number,
  lightness: number,
  saturationBoost: number = 0
) {
  return oklchCss(
    lightness / 100,
    nodeChroma(node, maxDegree, saturationBoost),
    node.hue
  );
}

/** Relative luminance of the panel that inline genre links sit on, read from
 *  `--panel`. Cached, since it changes only with the stylesheet. */
let panelLuminance: number | null = null;

function panelLuminanceValue(): number {
  // Black if the stylesheet has not applied, which overstates contrast rather
  // than understating it. No palette value is repeated here.
  panelLuminance ??= relativeLuminance(
    readColourToken("--panel", { l: 0, c: 0, h: 0 })
  );
  return panelLuminance;
}

/**
 * Like {@link nodeColour}, but enforces a minimum WCAG contrast ratio against
 * the sidebar's panel by lifting lightness. Chroma is held constant, so the
 * genre keeps its hue identity while the text stays legible. Use for inline
 * text links, where readability beats exact lightness.
 */
export function nodeColourReadable(
  node: NodeData,
  maxDegree: number,
  lightness: number,
  saturationBoost: number = 0,
  minContrast: number = 6
) {
  const chroma = nodeChroma(node, maxDegree, saturationBoost);
  const panel = panelLuminanceValue();

  let l = lightness;
  let luminance = relativeLuminance(oklchToRgb(l / 100, chroma, node.hue));
  while (l < 94 && (luminance + 0.05) / (panel + 0.05) < minContrast) {
    l += 2;
    luminance = relativeLuminance(oklchToRgb(l / 100, chroma, node.hue));
  }

  return oklchCss(l / 100, chroma, node.hue);
}

/** The types of edges in the graph. */
export const EdgeType = {
  Derivative: 0,
  Subgenre: 1,
  FusionGenre: 2,
} as const;

/** The types of edges in the graph (typed values of {@link EdgeType}) */
export type EdgeType = (typeof EdgeType)[keyof typeof EdgeType];

/** An edge in the graph, as stored on disk. */
export type EdgeOnDiskData = [
  /** The edge's source node ID */
  number,
  /** The edge's target node ID */
  number,
  /** The edge's type */
  EdgeType,
];

/** An edge in the graph. */
export type EdgeData = {
  /** The edge's source node ID (integer as a string). Consider using {@link nodeIdToInt} instead. */
  source: string;
  /** The edge's target node ID (integer as a string). Consider using {@link nodeIdToInt} instead. */
  target: string;
  /** The edge's type. */
  ty: EdgeType;
};

/** Artist data from the artist JSON files. */
export type ArtistFileData = {
  /** The artist's name. */
  name: string;
  /** The artist's description (wikitext). */
  description?: string;
  /** The artist's last revision date (ISO 8601). */
  last_revision_date: string;
  /** The artist's genres, as page IDs. */
  genres: number[];
};

// Ideally, we could integrate this into `commit.json`, but getting the "safe" URL from the checkout
// that GHA does is a bit tricky (we don't necessarily know what the remote's name is in that environment,
// and we'd have to convert the git@ URL to https://).
/** The link to the project's repository. */
export const REPO_LINK =
  "https://github.com/genresinspace/genresinspace.github.io";
