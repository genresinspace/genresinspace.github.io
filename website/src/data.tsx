/** The complete data dump (data.json). */
export type Data = {
  /** The Wikipedia domain. */
  wikipedia_domain: string;
  /** The Wikipedia database name. */
  wikipedia_db_name: string;
  /** The date of the dump (ISO 8601). */
  dump_date: string;
  /** The nodes in the graph. */
  nodes: NodeData[];
  /** The edges in the graph. */
  edges: EdgeData[];
  /** A map of links to page IDs. */
  links_to_page_ids: Record<string, string>;
  /** The maximum degree of any node in the graph. */
  max_degree: number;
};

/** A node in the graph. */
export type NodeData = {
  /** The node's ID (integer as a string). Consider using {@link nodeDataId} or {@link nodeIdToInt} instead. */
  id: string;
  /** The node's Wikipedia page title. */
  page_title: string;
  /** The node's Wikipedia wikitext description. */
  wikitext_description?: string;
  /** The node's label. */
  label: string;
  /** The node's last revision date (ISO 8601). */
  last_revision_date: string;
  /** The node's mixes. */
  mixes?:
    | { help_reason: string }
    | { playlist: string; note?: string }[]
    | { video: string; note?: string }[];
  /** The node's edges. */
  edges: number[];
};

export const nodeIdToInt = (id: string) => parseInt(id, 10);
export const nodeDataId = (data: NodeData) => nodeIdToInt(data.id);

/** An edge in the graph. */
export type EdgeData = {
  /** The edge's source node ID (integer as a string). Consider using {@link nodeIdToInt} instead. */
  source: string;
  /** The edge's target node ID (integer as a string). Consider using {@link nodeIdToInt} instead. */
  target: string;
  /** The edge's type. */
  ty: "Derivative" | "Subgenre" | "FusionGenre";
};

// Ideally, we could integrate this into `commit.json`, but getting the "safe" URL from the checkout
// that GHA does is a bit tricky (we don't necessarily know what the remote's name is in that environment,
// and we'd have to convert the git@ URL to https://).
/** The link to the project's repository. */
export const REPO_LINK =
  "https://github.com/genresinspace/genresinspace.github.io";
