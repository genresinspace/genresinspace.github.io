import { computePath } from "./pathfinding";
import { EdgeData, EdgeType, NodeData } from "../data";
import { VisibleTypes } from "../settings";

/** Build a small graph from `[source, target, type]` triples. */
function makeGraph(
  edgeTriples: [number, number, EdgeType][],
  nodeCount: number
) {
  const nodes: NodeData[] = Array.from({ length: nodeCount }, (_, i) => ({
    id: i.toString(),
    label: `Node ${i}`,
    x: 0,
    y: 0,
    hue: 0,
    edges: [],
  }));
  const edges: EdgeData[] = edgeTriples.map(([source, target, ty]) => ({
    source: source.toString(),
    target: target.toString(),
    ty,
  }));
  for (const [index, [source, target]] of edgeTriples.entries()) {
    nodes[source].edges.push(index);
    nodes[target].edges.push(index);
  }
  return { nodes, edges };
}

const ALL_VISIBLE: VisibleTypes = {
  [EdgeType.Derivative]: true,
  [EdgeType.Subgenre]: true,
  [EdgeType.FusionGenre]: true,
};

describe("computePath", () => {
  it("finds the shortest directed path", () => {
    // 0 → 1 → 2 → 3, plus a shortcut 0 → 2
    const { nodes, edges } = makeGraph(
      [
        [0, 1, EdgeType.Derivative],
        [1, 2, EdgeType.Derivative],
        [2, 3, EdgeType.Derivative],
        [0, 2, EdgeType.Derivative],
      ],
      4
    );
    expect(computePath(nodes, edges, ALL_VISIBLE, "0", "3")).toEqual([
      "0",
      "2",
      "3",
    ]);
  });

  it("does not traverse edges backwards", () => {
    const { nodes, edges } = makeGraph([[0, 1, EdgeType.Derivative]], 2);
    expect(computePath(nodes, edges, ALL_VISIBLE, "1", "0")).toBeNull();
  });

  it("returns null when no path exists", () => {
    const { nodes, edges } = makeGraph([[0, 1, EdgeType.Derivative]], 3);
    expect(computePath(nodes, edges, ALL_VISIBLE, "0", "2")).toBeNull();
  });

  it("respects edge type visibility", () => {
    const { nodes, edges } = makeGraph(
      [
        [0, 1, EdgeType.Subgenre],
        [1, 2, EdgeType.Derivative],
      ],
      3
    );
    const noSubgenres: VisibleTypes = {
      ...ALL_VISIBLE,
      [EdgeType.Subgenre]: false,
    };
    expect(computePath(nodes, edges, ALL_VISIBLE, "0", "2")).toEqual([
      "0",
      "1",
      "2",
    ]);
    expect(computePath(nodes, edges, noSubgenres, "0", "2")).toBeNull();
  });

  it("returns a single-node path for source === destination", () => {
    const { nodes, edges } = makeGraph([], 1);
    expect(computePath(nodes, edges, ALL_VISIBLE, "0", "0")).toEqual(["0"]);
  });
});
