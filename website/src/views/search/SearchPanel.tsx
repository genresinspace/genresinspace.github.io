import { Dispatch, useEffect, useRef, useState } from "react";

import {
  NodeColourLightness,
  NodeData,
  nodeColour,
  nodeIdToInt,
  useDataContext,
} from "../../data";
import { VisibleTypes } from "../../settings";
import type { SetSelectedId } from "../../App";
import type { ZoomRequest } from "../Graph";
import { SearchResult } from "../../services/search";

import { CloseIcon } from "../components/icons/CloseIcon";
import { SearchIcon } from "../components/icons/SearchIcon";
import { SwapIcon } from "../components/icons/SwapIcon";
import { colourStyles } from "../colours";

import { RouteAction, RouteState, SlotName } from "./useRouteState";
import { SearchResults } from "./SearchResults";
import { NoPathMessage, PathList } from "./PathList";

/**
 * The search panel: find a genre, optionally pick a destination to pathfind
 * to, and retarget either endpoint from the path itself.
 */
export function SearchPanel({
  route,
  routeDispatch,
  path,
  reversePath,
  results,
  selectedId,
  setSelectedId,
  setFocusedId,
  visibleTypes,
  requestZoom,
  onSetAsSource,
  onSetAsDestination,
  isMobile,
}: {
  route: RouteState;
  routeDispatch: Dispatch<RouteAction>;
  path: string[] | null;
  reversePath: string[] | null;
  results: SearchResult[];
  selectedId: string | null;
  setSelectedId: SetSelectedId;
  setFocusedId: (id: string | null) => void;
  visibleTypes: VisibleTypes;
  requestZoom: (kind: ZoomRequest["kind"]) => void;
  onSetAsSource: ((nodeId: string) => void) | null;
  onSetAsDestination: ((nodeId: string) => void) | null;
  isMobile: boolean;
}) {
  const { nodes } = useDataContext();
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const inputRef = (slot: SlotName) =>
    slot === "source" ? sourceInputRef : destinationInputRef;

  // The one deliberate programmatic-focus mechanism: event handlers set this
  // when the target input may not be mounted yet; it is consumed post-render.
  const pendingFocus = useRef<SlotName | null>(null);
  useEffect(() => {
    if (!pendingFocus.current) return;
    const input = inputRef(pendingFocus.current).current;
    pendingFocus.current = null;
    input?.focus();
    input?.select();
  });

  // Keyboard navigation over results
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  useEffect(() => setHighlightedIndex(-1), [results]);

  // Mobile starts as a collapsed pill until the user reaches for search
  const [expanded, setExpanded] = useState(!isMobile);

  const sourceNode = route.source.id
    ? nodes[nodeIdToInt(route.source.id)]
    : null;
  const destinationNode = route.destination.id
    ? nodes[nodeIdToInt(route.destination.id)]
    : null;
  // Progressive disclosure: the destination row appears once there's a source
  const showDestination =
    route.destination.id !== null || route.source.id !== null;
  const routeIsEmpty =
    !route.source.id && !route.source.query && !route.destination.id;

  const swap = () => {
    routeDispatch({ type: "swap" });
    requestZoom("path");
  };

  const pickResult = (id: string) => {
    const slot = route.activeSlot ?? "source";
    routeDispatch({ type: "set-id", slot, id });
    if (slot === "source") {
      const keepsDestination =
        route.destination.id !== null && route.destination.id !== id;
      setSelectedId(id, { zoom: keepsDestination ? "path" : "selection" });
      if (!keepsDestination) {
        // Invite the user to pick a destination next
        pendingFocus.current = "destination";
      }
    } else {
      // Keep the selection on the source; just zoom out to show the route
      requestZoom("path");
      inputRef("destination").current?.blur();
    }
  };

  const clearSlot = (slot: SlotName) => {
    if (slot === "destination") {
      routeDispatch({ type: "clear-slot", slot });
      if (route.source.id) {
        setSelectedId(route.source.id, { zoom: "selection" });
      }
    } else if (route.destination.id) {
      // Keep the destination; the user is rerouting from somewhere new
      routeDispatch({ type: "clear-slot", slot });
    } else {
      // Clearing the only endpoint resets everything (selection, hash, title)
      routeDispatch({ type: "clear-slot", slot });
      setSelectedId(null);
    }
    pendingFocus.current = slot;
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      const result = results[highlightedIndex === -1 ? 0 : highlightedIndex];
      if (result) {
        e.preventDefault();
        pickResult(result.id);
      }
    } else if (e.key === "Escape") {
      e.currentTarget.blur();
      if (isMobile && routeIsEmpty) setExpanded(false);
    }
  };

  // `/` focuses search from anywhere (unless already typing somewhere)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        return;
      }
      e.preventDefault();
      setExpanded(true);
      sourceInputRef.current?.focus();
      sourceInputRef.current?.select();
      pendingFocus.current = "source";
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (isMobile && !expanded && routeIsEmpty) {
    return (
      <button
        className={`flex items-center gap-2 h-11 px-4 ${colourStyles.bg.shell} ${colourStyles.text.secondary} border ${colourStyles.border.light} rounded-full`}
        onClick={() => {
          setExpanded(true);
          pendingFocus.current = "source";
        }}
      >
        <SearchIcon width={16} height={16} stroke="#9ba6bc" />
        Search genres...
      </button>
    );
  }

  const resultsLabel = showDestination
    ? route.activeSlot === "destination"
      ? "Destination results"
      : "Source results"
    : undefined;

  return (
    <div>
      <div
        className={`flex ${colourStyles.bg.shell} ${colourStyles.text.primary} border ${colourStyles.border.light}`}
      >
        <div className="flex-1 min-w-0 relative">
          <SlotRow
            slotName="source"
            slot={route.source}
            node={sourceNode}
            active={route.activeSlot === "source"}
            placeholder="Search for genre..."
            showRail={showDestination}
            inputRef={sourceInputRef}
            routeDispatch={routeDispatch}
            onClear={() => clearSlot("source")}
            onKeyDown={onInputKeyDown}
            onChipClick={() => {
              routeDispatch({ type: "focus-slot", slot: "source" });
              pendingFocus.current = "source";
            }}
            onBlur={() => {
              routeDispatch({ type: "blur-slot", slot: "source" });
              if (isMobile && routeIsEmpty) setExpanded(false);
            }}
          />
          {showDestination && (
            <>
              <div className={`border-t ${colourStyles.border.divider}`} />
              <SlotRow
                slotName="destination"
                slot={route.destination}
                node={destinationNode}
                active={route.activeSlot === "destination"}
                placeholder="Destination..."
                showRail
                inputRef={destinationInputRef}
                routeDispatch={routeDispatch}
                onClear={() => clearSlot("destination")}
                onKeyDown={onInputKeyDown}
                onChipClick={() => {
                  routeDispatch({ type: "focus-slot", slot: "destination" });
                  pendingFocus.current = "destination";
                }}
                onBlur={() =>
                  routeDispatch({ type: "blur-slot", slot: "destination" })
                }
              />
              {/* Dashed connector between the two endpoint dots */}
              <div
                className="absolute left-[11px] top-8 bottom-8 border-l border-dashed border-[#c9a86a]/40 pointer-events-none"
                aria-hidden
              />
            </>
          )}
        </div>
        {showDestination && (
          <button
            className={`w-11 flex-none self-stretch flex items-center justify-center ${colourStyles.search.button} transition-colors disabled:opacity-30`}
            disabled={!route.source.id || !route.destination.id}
            onClick={swap}
            title="Swap source and destination"
          >
            <SwapIcon width={16} height={16} stroke="#9ba6bc" />
          </button>
        )}
      </div>

      {results.length > 0 && (
        <SearchResults
          results={results}
          label={resultsLabel}
          highlightedIndex={highlightedIndex}
          onPick={pickResult}
          setFocusedId={setFocusedId}
        />
      )}

      {path && (
        <PathList
          path={path}
          selectedId={selectedId}
          visibleTypes={visibleTypes}
          setSelectedId={setSelectedId}
          setFocusedId={setFocusedId}
          onSetAsSource={onSetAsSource}
          onSetAsDestination={onSetAsDestination}
        />
      )}
      {!path && sourceNode && destinationNode && (
        <NoPathMessage
          sourceNode={sourceNode}
          destinationNode={destinationNode}
          reverseExists={reversePath !== null}
          visibleTypes={visibleTypes}
          onSwap={swap}
        />
      )}
    </div>
  );
}

/**
 * One endpoint row: a resolved chip (tap to edit) or a text input, preceded
 * by a rail dot when the destination row is visible.
 */
function SlotRow({
  slotName,
  slot,
  node,
  active,
  placeholder,
  showRail,
  inputRef,
  routeDispatch,
  onClear,
  onKeyDown,
  onChipClick,
  onBlur,
}: {
  slotName: SlotName;
  slot: { id: string | null; query: string };
  node: NodeData | null;
  active: boolean;
  placeholder: string;
  showRail: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  routeDispatch: Dispatch<RouteAction>;
  onClear: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onChipClick: () => void;
  onBlur: () => void;
}) {
  const { max_degree: maxDegree } = useDataContext();
  const showChip = node !== null && !active;

  return (
    <div className="flex items-center h-11">
      {showRail && (
        <div className="w-6 flex-none flex items-center justify-center">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              node ? "" : "border-2 border-[#9ba6bc]"
            }`}
            style={
              node
                ? {
                    background: nodeColour(
                      node,
                      maxDegree,
                      NodeColourLightness.GraphNode
                    ),
                  }
                : undefined
            }
          />
        </div>
      )}
      {showChip ? (
        <>
          <button
            className={`flex-1 min-w-0 text-left mx-1 px-2 py-1.5 rounded truncate ${colourStyles.text.primary} ${colourStyles.hover.subtle} transition-colors`}
            onClick={onChipClick}
            title={`Change ${slotName}`}
          >
            {node.label}
          </button>
          <button
            className="w-10 h-11 flex-none flex items-center justify-center hover:opacity-75 transition-opacity"
            onClick={onClear}
            title={`Clear ${slotName}`}
          >
            <CloseIcon width={16} height={16} stroke="#9ba6bc" />
          </button>
        </>
      ) : (
        <div className="relative flex-1 min-w-0 h-full">
          {!showRail && (
            <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
              <SearchIcon width={16} height={16} stroke="#9ba6bc" />
            </div>
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            className={`w-full h-full p-2 ${showRail ? "" : "pl-8"} ${slot.query ? "pr-8" : ""} ${colourStyles.search.input}`}
            value={slot.query}
            onChange={(e) =>
              routeDispatch({
                type: "set-query",
                slot: slotName,
                query: e.target.value,
              })
            }
            onFocus={() =>
              routeDispatch({ type: "focus-slot", slot: slotName })
            }
            onBlur={onBlur}
            onKeyDown={onKeyDown}
          />
          {slot.query && (
            <button
              className="absolute inset-y-0 right-0 w-10 flex items-center justify-center hover:opacity-75 transition-opacity"
              // Fires before blur so the clear wins over blur-snapback
              onMouseDown={(e) => e.preventDefault()}
              onClick={onClear}
              title={`Clear ${slotName}`}
            >
              <CloseIcon width={16} height={16} stroke="#9ba6bc" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
