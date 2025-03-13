/** The complete data dump (data.json). */
export type Data = {
  wikipedia_domain: string;
  wikipedia_db_name: string;
  dump_date: string;
  nodes: NodeData[];
  edges: EdgeData[];
  links_to_page_ids: Record<string, string>;
  max_degree: number;
};

/** A node in the graph. */
export type NodeData = {
  id: string;
  page_title: string;
  wikitext_description?: string;
  label: string;
  last_revision_date: string;
  mixes?:
    | { help_reason: string }
    | { playlist: string; note?: string }[]
    | { video: string; note?: string }[];
  edges: number[];
};

/** An edge in the graph. */
export type EdgeData = {
  source: string;
  target: string;
  ty: "Derivative" | "Subgenre" | "FusionGenre";
};

// Ideally, we could integrate this into `commit.json`, but getting the "safe" URL from the checkout
// that GHA does is a bit tricky (we don't necessarily know what the remote's name is in that environment,
// and we'd have to convert the git@ URL to https://).
/** The link to the project's repository. */
export const REPO_LINK =
  "https://github.com/genresinspace/genresinspace.github.io";
