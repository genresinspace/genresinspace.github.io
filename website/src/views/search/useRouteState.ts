import { Dispatch, useMemo, useReducer } from "react";

import { Data, NodeData, nodeIdToInt } from "../../data";
import { VisibleTypes } from "../../settings";
import { computePath } from "../../util/pathfinding";
import { searchGenres, SearchResult } from "../../services/search";
import type { SearchMode } from "../graph/GraphViewLabels";

/** One endpoint of the route: a resolved node (if any) and the input text. */
export type Slot = {
  /** The resolved node id, or null when the slot is empty. */
  id: string | null;
  /** The current input text; equals the node's label right after resolving. */
  query: string;
};

/** Names of the two route endpoints. */
export type SlotName = "source" | "destination";

/**
 * The whole search state. Everything else (results, path, reverse path,
 * search mode) is derived — there is deliberately nothing else to get stale.
 */
export type RouteState = {
  source: Slot;
  destination: Slot;
  /** The slot whose input currently has focus, if any. */
  activeSlot: SlotName | null;
};

/** Actions the search UI and the app dispatch to mutate the route. */
export type RouteAction =
  /** Input text changed. Keeps the slot's resolved id until a new pick. */
  | { type: "set-query"; slot: SlotName; query: string }
  /** Input gained focus. */
  | { type: "focus-slot"; slot: SlotName }
  /** Input lost focus; snaps the text back to the resolved node's label. */
  | { type: "blur-slot"; slot: SlotName }
  /** Resolve a slot to a node (search pick, graph label button, sidebar). */
  | { type: "set-id"; slot: SlotName; id: string }
  /** Clear a slot entirely. */
  | { type: "clear-slot"; slot: SlotName }
  /** Swap source and destination. */
  | { type: "swap" }
  /** Replace the whole route (hash navigation, full reset). */
  | { type: "set-route"; sourceId: string | null; destinationId: string | null }
  /**
   * A node was selected outside the search panel (graph click). With no
   * destination set, it becomes the source; during pathfinding the route is
   * left untouched (only the app's selectedId changes).
   */
  | { type: "select-node"; id: string };

const EMPTY_SLOT: Slot = { id: null, query: "" };

function makeRouteReducer(nodes: NodeData[]) {
  const labelOf = (id: string | null) =>
    id ? nodes[nodeIdToInt(id)].label : "";
  const resolvedSlot = (id: string | null): Slot => ({
    id,
    query: labelOf(id),
  });

  return (state: RouteState, action: RouteAction): RouteState => {
    switch (action.type) {
      case "set-query":
        return {
          ...state,
          [action.slot]: { ...state[action.slot], query: action.query },
          activeSlot: action.slot,
        };
      case "focus-slot":
        return { ...state, activeSlot: action.slot };
      case "blur-slot": {
        if (state.activeSlot !== action.slot) return state;
        const slot = state[action.slot];
        return {
          ...state,
          // Snap abandoned edits back to the resolved label
          [action.slot]: slot.id ? resolvedSlot(slot.id) : slot,
          activeSlot: null,
        };
      }
      case "set-id": {
        const next = {
          ...state,
          [action.slot]: resolvedSlot(action.id),
          activeSlot: null,
        };
        // A route from a node to itself is meaningless: collapse it by
        // clearing the slot that wasn't just set.
        const other: SlotName =
          action.slot === "source" ? "destination" : "source";
        if (next.source.id === next.destination.id) {
          next[other] = EMPTY_SLOT;
        }
        return next;
      }
      case "clear-slot":
        return { ...state, [action.slot]: EMPTY_SLOT, activeSlot: action.slot };
      case "swap":
        return {
          ...state,
          source: state.destination,
          destination: state.source,
        };
      case "set-route":
        return {
          source: resolvedSlot(action.sourceId),
          destination: resolvedSlot(
            action.destinationId !== action.sourceId
              ? action.destinationId
              : null
          ),
          activeSlot: null,
        };
      case "select-node":
        if (state.destination.id) return state;
        return { ...state, source: resolvedSlot(action.id) };
      default:
        return action satisfies never;
    }
  };
}

/** Everything the search UI and the rest of the app needs about the route. */
export type RouteSearch = {
  route: RouteState;
  routeDispatch: Dispatch<RouteAction>;
  /** Shortest source→destination path, or null (no route set / no path). */
  path: string[] | null;
  /** Computed only when `path` is null: does the opposite direction work? */
  reversePath: string[] | null;
  /**
   * The two endpoints when both are set but no path connects them. Lets the
   * graph highlight both stars and draw a broken connector, rather than leaving
   * only the selected endpoint lit.
   */
  noPathEndpoints: { source: string; destination: string } | null;
  /** Search results for the active slot's query. */
  results: SearchResult[];
  searchMode: SearchMode;
};

/**
 * Search/route state for the app: a small reducer over two slots, with the
 * path, reverse path, and search results all derived from it.
 */
export function useRouteSearch(
  data: Data,
  visibleTypes: VisibleTypes
): RouteSearch {
  const { nodes, edges } = data;
  const [route, routeDispatch] = useReducer(
    useMemo(() => makeRouteReducer(nodes), [nodes]),
    { source: EMPTY_SLOT, destination: EMPTY_SLOT, activeSlot: null }
  );

  const sourceId = route.source.id;
  const destinationId = route.destination.id;

  const path = useMemo(
    () =>
      sourceId && destinationId && sourceId !== destinationId
        ? computePath(nodes, edges, visibleTypes, sourceId, destinationId)
        : null,
    [nodes, edges, visibleTypes, sourceId, destinationId]
  );

  const reversePath = useMemo(
    () =>
      sourceId && destinationId && sourceId !== destinationId && path === null
        ? computePath(nodes, edges, visibleTypes, destinationId, sourceId)
        : null,
    [nodes, edges, visibleTypes, sourceId, destinationId, path]
  );

  const noPathEndpoints = useMemo(
    () =>
      sourceId && destinationId && sourceId !== destinationId && path === null
        ? { source: sourceId, destination: destinationId }
        : null,
    [sourceId, destinationId, path]
  );

  const results = useMemo(() => {
    const slot = route.activeSlot ? route[route.activeSlot] : null;
    if (!slot) return [];
    // Don't re-offer the node the slot is already resolved to
    if (slot.id && slot.query === nodes[nodeIdToInt(slot.id)].label) return [];
    return searchGenres(nodes, slot.query);
  }, [route, nodes]);

  const searchMode: SearchMode = destinationId
    ? "path"
    : sourceId
      ? "selected"
      : "initial";

  return {
    route,
    routeDispatch,
    path,
    reversePath,
    noPathEndpoints,
    results,
    searchMode,
  };
}
