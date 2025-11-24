import { createContext, useContext } from "react";
import { useTheme } from "./theme";

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

/** Values for node colour lightness in different contexts - Dark mode */
export const NodeColourLightnessDark = {
  /** The lightness of the darker background colour. */
  DarkerBackground: 15,
  /** The lightness of the background colour. */
  Background: 30,
  /** The lightness of a hovered background colour. */
  HoveredBackground: 40,
  /** The lightness of the graph node's colour. */
  GraphNode: 60,
  /** The lightness of the graph label's background colour. */
  GraphLabelBackground: 25,
  /** The lightness of the graph label's background border colour. */
  GraphLabelBackgroundBorder: 35,
  /** The lightness of the graph label's text colour. */
  GraphLabelText: 60,
  /** The lightness of a link's text colour. */
  LinkText: 70,
  /** The lightness of a link's text colour when hovered. */
  LinkTextHover: 80,
} as const;

/** Values for node colour lightness in different contexts - Light mode */
export const NodeColourLightnessLight = {
  ...NodeColourLightnessDark,
  /** The lightness of a link's text colour. */
  LinkText: 40,
  /** The lightness of a link's text colour when hovered. */
  LinkTextHover: 30,
} as const;

/** Hook to get the correct node colour lightness values based on the current theme */
export function useNodeColourLightness() {
  const { theme } = useTheme();
  return theme === "light" ? NodeColourLightnessLight : NodeColourLightnessDark;
}

/** Given a node, calculate its colour, factoring in degree and lightness */
export function nodeColour(
  node: NodeData,
  maxDegree: number,
  lightness: number,
  saturationBoost: number = 0
) {
  const hash = node.id
    .split("")
    .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0);
  const hue = Math.abs(hash % 360);
  const colour = `hsl(${hue}, ${
    ((node.edges.length / maxDegree) * 0.8 + 0.2) * 100 + saturationBoost
  }%, ${lightness}%)`;
  return colour;
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
