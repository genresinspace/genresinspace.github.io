import { useEffect, useState, useCallback, useRef, useMemo } from "react";

import { Graph, ZoomRequest } from "./views/Graph";
import { SearchPanel } from "./views/search/SearchPanel";
import { RouteSearch, useRouteSearch } from "./views/search/useRouteState";
import { DEFAULT_SETTINGS, SettingsData } from "./settings";
import {
  Data,
  nodeIdToInt,
  DataContext,
  DataOnDisk,
  postProcessData,
} from "./data";

import { Sidebar, SIDEBAR_DEFAULT_WIDTH } from "./views/sidebar/Sidebar";
import { DataCache, DataCacheContext } from "./services/dataCache";
import { colourStyles } from "./views/colours";
import { textStyles } from "./views/typography";

import "./tailwind.css";

/** Options for the wrapper `setSelectedId`. */
export type SetSelectedOptions = {
  /** If set, also request a zoom-to-fit after the selection is applied. */
  zoom?: "selection" | "path";
};
/** Signature shared by the wrapper `setSelectedId` and its prop type. */
export type SetSelectedId = (
  id: string | null,
  opts?: SetSelectedOptions
) => void;

// Global constant for arrow key navigation (developer tool)
const ENABLE_ARROW_KEY_NAVIGATION = import.meta.env.DEV;

// Minimum height for mobile sidebar when collapsed (percentage of viewport)
const MOBILE_SIDEBAR_MIN_HEIGHT = 10;

/**
 * Normalize one hash part to a canonical node id. Hashes may carry a
 * human-readable slug after the numeric id (e.g. "48 ambient" / "48%20ambient");
 * everything downstream compares ids as exact strings ("48"), so the slug must
 * be stripped here — otherwise e.g. the selected star never matches
 * `node.id === selectedId` and loses its graph label.
 */
function canonicalNodeId(part: string | undefined): string | null {
  if (!part) return null;
  let decoded = part;
  try {
    decoded = decodeURIComponent(part);
  } catch {
    // Malformed escape sequence: fall back to the raw text
  }
  const id = parseInt(decoded, 10);
  return Number.isFinite(id) ? String(id) : null;
}

/** Parse hash string into source, optional destination, and optional selected IDs */
function parseHash(hash: string): {
  sourceId: string | null;
  destinationId: string | null;
  selectedId: string | null;
} {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return { sourceId: null, destinationId: null, selectedId: null };

  const parts = raw.split(",");
  const sourceId = canonicalNodeId(parts[0]);
  const destinationId = parts.length > 1 ? canonicalNodeId(parts[1]) : null;
  const selectedId = parts.length > 2 ? canonicalNodeId(parts[2]) : null;
  return { sourceId, destinationId, selectedId };
}

/** Build a hash string from source, optional destination, and optional selected IDs */
function buildHash(
  sourceId: string | null,
  destinationId: string | null,
  selectedId: string | null
): string {
  if (!sourceId) return "";
  if (destinationId) {
    // Only include selectedId if it differs from sourceId
    if (selectedId && selectedId !== sourceId) {
      return `#${sourceId},${destinationId},${selectedId}`;
    }
    return `#${sourceId},${destinationId}`;
  }
  return `#${sourceId}`;
}

/** The main app component */
function App() {
  const loading = useData();
  const [dataCache] = useState(() => new DataCache());

  if (loading.state === "loading") {
    return (
      <div
        className={`flex w-screen h-screen items-center justify-center ${colourStyles.bg.app} ${colourStyles.text.primary}`}
        style={{
          background:
            "radial-gradient(ellipse 75% 60% at 50% 42%, rgba(28, 42, 76, 0.35), rgba(4, 6, 15, 0) 70%), #04060f",
        }}
      >
        <div className="flex flex-col items-center gap-5 text-center">
          <div
            className={`w-14 h-14 border ${colourStyles.loading.spinner} rounded-full animate-spin`}
          />
          <div>
            <div
              className={`font-display font-semibold ${textStyles.display} tracking-[0.3em] ml-[0.3em] ${colourStyles.text.brass}`}
            >
              genres in space
            </div>
            <div
              className={`font-body italic ${textStyles.body} ${colourStyles.text.meta}`}
            >
              charting the heavens&hellip;
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    return (
      <DataCacheContext.Provider value={dataCache}>
        <LoadedApp data={loading.data} />
      </DataCacheContext.Provider>
    );
  }
}

function useData(): { state: "loading" } | { state: "loaded"; data: Data } {
  const [data, setData] = useState<Data | undefined>();

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/data.json");
        const dataOnDisk: DataOnDisk = await response.json();
        const data = postProcessData(dataOnDisk);
        setData(data);
      } catch (error) {
        console.error("Error loading data:", error);
      }
    }
    fetchData();
  }, []);

  if (!data) {
    return { state: "loading" };
  } else {
    return { state: "loaded", data };
  }
}

function LoadedApp({ data }: { data: Data }) {
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const {
    selectedId,
    setSelectedId,
    focusedId,
    setFocusedId,
    route,
    routeDispatch,
    path,
    reversePath,
    results,
    searchMode,
    zoomRequest,
    requestZoom,
  } = useSelectionAndRoute(data, settings);

  const onSetAsSource = useMemo(() => {
    if (searchMode !== "path") return null;
    return (nodeId: string) => {
      routeDispatch({ type: "set-id", slot: "source", id: nodeId });
      setSelectedId(nodeId);
    };
  }, [searchMode, routeDispatch, setSelectedId]);

  const onSetAsDestination = useMemo(() => {
    if (searchMode === "initial") return null;
    return (nodeId: string) => {
      routeDispatch({ type: "set-id", slot: "destination", id: nodeId });
      setSelectedId(nodeId);
    };
  }, [searchMode, routeDispatch, setSelectedId]);

  // Mobile sidebar state
  const [mobileSidebarHeight, setMobileSidebarHeight] = useState(50); // percentage
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [dragStartHeight, setDragStartHeight] = useState(50); // track where drag started

  // Track actual rendered sidebar dimensions for camera offset
  const sidebarContainerRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [sidebarHeightPx, setSidebarHeightPx] = useState(0);

  useEffect(() => {
    const el = sidebarContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSidebarWidth(entry.contentRect.width);
        setSidebarHeightPx(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Detect mobile screen size (768px is Tailwind's md breakpoint)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Arrow key navigation handler
  useEffect(() => {
    if (!ENABLE_ARROW_KEY_NAVIGATION) return;

    const nodeIds = Object.keys(data.nodes);
    const nodeCount = nodeIds.length;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedId) return;

      // Don't interfere with text input
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        return;
      }

      const currentIndex = parseInt(selectedId);

      if (isNaN(currentIndex)) return;

      let newIndex: number;

      switch (event.key) {
        case "ArrowLeft":
          newIndex = (currentIndex - 1 + nodeCount) % nodeCount;
          setSelectedId(newIndex.toString());
          break;
        case "ArrowRight":
          newIndex = (currentIndex + 1) % nodeCount;
          setSelectedId(newIndex.toString());
          break;
        default:
          return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, data.nodes, setSelectedId]);

  // Mobile sidebar drag handlers
  const handleTouchStart = useCallback(() => {
    setIsDraggingSidebar(true);
    setDragStartHeight(mobileSidebarHeight);
  }, [mobileSidebarHeight]);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDraggingSidebar) return;

      // Prevent scrolling while dragging
      e.preventDefault();

      const touch = e.touches[0];
      const windowHeight = window.innerHeight;
      const touchY = touch.clientY;
      const newHeight = ((windowHeight - touchY) / windowHeight) * 100;

      // Clamp between minimum (handle visible) and 100%
      const clampedHeight = Math.min(
        Math.max(newHeight, MOBILE_SIDEBAR_MIN_HEIGHT),
        100
      );
      setMobileSidebarHeight(clampedHeight);
    },
    [isDraggingSidebar]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDraggingSidebar(false);

    // Directional snap: snap to next position in the direction of movement
    const snapPositions = [MOBILE_SIDEBAR_MIN_HEIGHT, 50, 100];
    const currentHeight = mobileSidebarHeight;

    if (currentHeight > dragStartHeight) {
      // Dragging upward - snap to first position >= current (and > start)
      const target = snapPositions.find(
        (pos) => pos >= currentHeight && pos > dragStartHeight
      );
      if (target !== undefined) {
        setMobileSidebarHeight(target);
      }
    } else if (currentHeight < dragStartHeight) {
      // Dragging downward - snap to last position <= current (and < start)
      const target = [...snapPositions]
        .reverse()
        .find((pos) => pos <= currentHeight && pos < dragStartHeight);
      if (target !== undefined) {
        setMobileSidebarHeight(target);
      }
    }
    // If no movement, stay at current position
  }, [mobileSidebarHeight, dragStartHeight]);

  useEffect(() => {
    if (isDraggingSidebar) {
      document.addEventListener("touchmove", handleTouchMove, {
        passive: false,
      });
      document.addEventListener("touchend", handleTouchEnd);
      return () => {
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleTouchEnd);
      };
    }
  }, [isDraggingSidebar, handleTouchMove, handleTouchEnd]);

  const isFullscreen = isMobile && mobileSidebarHeight >= 100;
  const isMinimized =
    isMobile && mobileSidebarHeight <= MOBILE_SIDEBAR_MIN_HEIGHT;

  // Compute viewport offset for the camera to center the visible area
  const viewportOffsetX = isMobile ? 0 : -sidebarWidth;
  const viewportOffsetY = isMobile ? -sidebarHeightPx : 0;

  const searchComponent = (
    <SearchPanel
      route={route}
      routeDispatch={routeDispatch}
      path={path}
      reversePath={reversePath}
      results={results}
      selectedId={selectedId}
      setSelectedId={setSelectedId}
      setFocusedId={setFocusedId}
      visibleTypes={settings.visibleTypes}
      requestZoom={requestZoom}
      onSetAsSource={onSetAsSource}
      onSetAsDestination={onSetAsDestination}
      isMobile={isMobile}
    />
  );

  return (
    <DataContext.Provider value={data}>
      <div className="relative w-screen h-screen overflow-hidden">
        {/* Graph container - fills entire viewport */}
        {(!isFullscreen || isDraggingSidebar) && (
          <div className="absolute inset-0 touch-none">
            <Graph
              settings={settings}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              focusedId={focusedId}
              path={path}
              viewportOffsetX={viewportOffsetX}
              viewportOffsetY={viewportOffsetY}
              searchMode={searchMode}
              onSetAsSource={onSetAsSource}
              onSetAsDestination={onSetAsDestination}
              zoomRequest={zoomRequest}
            />
          </div>
        )}

        {/* Search - positioned relative to viewport */}
        {(!isFullscreen || isDraggingSidebar) && (
          <div className="absolute top-2 left-2 md:top-4 md:left-4 z-50 w-[calc(100%-1rem)] md:w-sm">
            {searchComponent}
          </div>
        )}

        {/* Sidebar - overlays graph: bottom sheet on mobile, right panel on desktop */}
        <div
          ref={sidebarContainerRef}
          className="absolute bottom-[env(safe-area-inset-bottom)] w-full md:bottom-0 md:right-0 md:top-0 md:w-auto z-10"
          style={
            isMobile
              ? {
                  height: `${mobileSidebarHeight}%`,
                  minHeight: "60px",
                  transition: !isDraggingSidebar
                    ? "height 0.3s ease-out"
                    : "none",
                }
              : { height: "100%" }
          }
        >
          <Sidebar
            settings={settings}
            setSettings={setSettings}
            selectedId={selectedId}
            setFocusedId={setFocusedId}
            onMobileDragStart={handleTouchStart}
            isMobile={isMobile}
            isFullscreen={isFullscreen}
            isMinimized={isMinimized}
            searchComponent={isFullscreen ? searchComponent : undefined}
          />
        </div>
      </div>
    </DataContext.Provider>
  );
}

function useSelectionAndRoute(
  data: Data,
  settings: SettingsData
): RouteSearch & {
  selectedId: string | null;
  setSelectedId: SetSelectedId;
  focusedId: string | null;
  setFocusedId: (id: string | null) => void;
  zoomRequest: ZoomRequest | null;
  requestZoom: (kind: ZoomRequest["kind"]) => void;
} {
  // Selection
  const [selectedId, setSelectedIdRaw] = useState<string | null>(() => {
    const { sourceId } = parseHash(window.location.hash);
    return sourceId;
  });

  // Pending zoom-to-fit triggered by URL navigation (direct URL, browser
  // back/forward, GenreLink href). Direct setSelectedId calls (graph clicks,
  // search list clicks) deliberately do not set this.
  const [zoomRequest, setZoomRequest] = useState<ZoomRequest | null>(null);
  const requestZoom = useCallback(
    (kind: ZoomRequest["kind"]) => setZoomRequest({ kind }),
    []
  );

  // Route state; the path, reverse path, and search results are derived from
  // it, so a visibleTypes change recomputes them with no action required.
  const routeSearch = useRouteSearch(data, settings.visibleTypes);
  const { route, routeDispatch } = routeSearch;

  // Focus
  const [focusedId, setFocusedRawId] = useState<string | null>(null);
  // Read selectedId via ref so setFocusedId stays referentially stable.
  // Why: the hashchange effect below depends on setFocusedId; if that callback
  // changed on every selection it would re-fire handleHashChange and trigger
  // unwanted zooms on graph clicks (URL is updated by pushState before the
  // effect re-runs).
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const setFocusedId = useCallback((id: string | null) => {
    if (id) {
      setFocusedRawId(id);
    } else if (selectedIdRef.current) {
      setFocusedRawId(selectedIdRef.current);
    } else {
      setFocusedRawId(null);
    }
  }, []);

  // Wrapper that updates selectedId, search state, focus, and title. Callers
  // pass `{ zoom: "selection" | "path" }` when the action should also trigger
  // a zoom-to-fit (e.g. picking from the search list, setting a path
  // endpoint). Direct graph clicks pass no options so they do not zoom.
  const setSelectedId = useCallback(
    (newId: string | null, opts?: SetSelectedOptions) => {
      setSelectedIdRaw(newId);
      if (newId) {
        const nodeData = data.nodes[nodeIdToInt(newId)];
        routeDispatch({ type: "select-node", id: newId });
        if (nodeData) {
          document.title = `genres in space: ${nodeData.label}`;
        }
      } else {
        routeDispatch({
          type: "set-route",
          sourceId: null,
          destinationId: null,
        });
        document.title = "genres in space";
        if (window.location.hash) {
          window.history.pushState(null, "", window.location.pathname);
        }
      }
      setFocusedId(newId);
      // Default to no-zoom: explicitly clear any previously-set request so
      // callers must opt in to zooming.
      setZoomRequest(opts?.zoom ? { kind: opts.zoom } : null);
    },
    [data, setFocusedId, routeDispatch]
  );

  // Sync URL hash whenever the route or selectedId changes
  // Clearing the hash is handled imperatively in setSelectedId(null)
  const sourceId = route.source.id;
  const destinationId = route.destination.id;
  useEffect(() => {
    if (!sourceId) return;

    const newHash = buildHash(sourceId, destinationId, selectedId);
    if (window.location.hash !== newHash) {
      window.history.pushState(null, "", newHash);
    }
  }, [sourceId, destinationId, selectedId]);

  // Handle hash changes (browser back/forward, GenreLink clicks)
  useEffect(() => {
    const handleHashChange = () => {
      const {
        sourceId,
        destinationId,
        selectedId: hashSelectedId,
      } = parseHash(window.location.hash);
      if (sourceId && destinationId) {
        // Full path: #sourceId,destinationId[,selectedId]
        const effectiveSelectedId = hashSelectedId || sourceId;
        setSelectedIdRaw(effectiveSelectedId);
        const nodeData = data.nodes[nodeIdToInt(effectiveSelectedId)];
        if (nodeData) {
          document.title = `genres in space: ${nodeData.label}`;
        }
        setFocusedId(effectiveSelectedId);
        routeDispatch({ type: "set-route", sourceId, destinationId });
        setZoomRequest({ kind: "path" });
      } else if (sourceId) {
        // Single node: #sourceId — always select as new source
        setSelectedIdRaw(sourceId);
        const nodeData = data.nodes[nodeIdToInt(sourceId)];
        if (nodeData) {
          document.title = `genres in space: ${nodeData.label}`;
        }
        setFocusedId(sourceId);
        routeDispatch({ type: "set-route", sourceId, destinationId: null });
        setZoomRequest({ kind: "selection" });
      } else {
        // Empty hash — clear selection
        setSelectedIdRaw(null);
        document.title = "genres in space";
        setFocusedId(null);
        routeDispatch({
          type: "set-route",
          sourceId: null,
          destinationId: null,
        });
      }
    };

    // Handle initial load
    handleHashChange();

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [setFocusedId, routeDispatch, data]);

  return {
    ...routeSearch,
    selectedId,
    setSelectedId,
    focusedId,
    setFocusedId,
    zoomRequest,
    requestZoom,
  };
}

/** The main app component */
export default App;
