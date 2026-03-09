import {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  Dispatch,
} from "react";

import { Graph } from "./views/Graph";
import {
  Search,
  SearchAction,
  SearchState,
  useSearchState,
} from "./views/Search";
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
import { ThemeProvider } from "./theme";

import "./tailwind.css";

// Global constant for arrow key navigation (developer tool)
const ENABLE_ARROW_KEY_NAVIGATION = import.meta.env.DEV;

// Minimum height for mobile sidebar when collapsed (percentage of viewport)
const MOBILE_SIDEBAR_MIN_HEIGHT = 10;

/** Parse hash string into source, optional destination, and optional selected IDs */
function parseHash(hash: string): {
  sourceId: string | null;
  destinationId: string | null;
  selectedId: string | null;
} {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return { sourceId: null, destinationId: null, selectedId: null };

  const parts = raw.split(",");
  const sourceId = parts[0] || null;
  const destinationId = parts.length > 1 ? parts[1] || null : null;
  const selectedId = parts.length > 2 ? parts[2] || null : null;
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
      <ThemeProvider>
        <div
          className={`flex w-screen h-screen items-center justify-center ${colourStyles.app.background} text-slate-900 dark:text-white`}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-slate-300 dark:border-slate-600 border-t-teal-600 dark:border-t-white rounded-full animate-spin" />
            <div>Loading...</div>
          </div>
        </div>
      </ThemeProvider>
    );
  } else {
    return (
      <ThemeProvider>
        <DataCacheContext.Provider value={dataCache}>
          <LoadedApp data={loading.data} />
        </DataCacheContext.Provider>
      </ThemeProvider>
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
    searchState,
    searchDispatch,
  } = useSelectedIdAndFilterAndFocus(data, settings);

  const searchMode = searchState.type;

  const onSetAsSource = useMemo(() => {
    if (searchMode !== "path") return null;
    return (nodeId: string) => {
      if (searchState.type === "path") {
        searchDispatch({
          type: "restore-path",
          sourceId: nodeId,
          destinationId: searchState.destinationId,
        });
        setSelectedId(nodeId);
      }
    };
  }, [searchMode, searchState, searchDispatch, setSelectedId]);

  const onSetAsDestination = useMemo(() => {
    if (searchMode === "initial") return null;
    return (nodeId: string) => {
      if (searchState.type === "selected") {
        searchDispatch({
          type: "selected:select-destination",
          destinationId: nodeId,
        });
      } else if (searchState.type === "path") {
        searchDispatch({
          type: "restore-path",
          sourceId: searchState.sourceId,
          destinationId: nodeId,
        });
      }
      setSelectedId(nodeId);
    };
  }, [searchMode, searchState, searchDispatch, setSelectedId]);

  // Camera animation state — used to defer heavy sidebar content (e.g. iframes)
  const [isCameraAnimating, setIsCameraAnimating] = useState(false);

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
    <Search
      selectedId={selectedId}
      setFocusedId={setFocusedId}
      searchState={searchState}
      searchDispatch={searchDispatch}
      visibleTypes={settings.visibleTypes}
      setSelectedId={setSelectedId}
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
              path={searchState.type === "path" ? searchState.path : null}
              viewportOffsetX={viewportOffsetX}
              viewportOffsetY={viewportOffsetY}
              onCameraAnimatingChange={setIsCameraAnimating}
              searchMode={searchMode}
              onSetAsSource={onSetAsSource}
              onSetAsDestination={onSetAsDestination}
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
            isCameraAnimating={isCameraAnimating}
          />
        </div>
      </div>
    </DataContext.Provider>
  );
}

function useSelectedIdAndFilterAndFocus(
  data: Data,
  settings: SettingsData
): {
  selectedId: string | null;
  setSelectedId: (newId: string | null) => void;
  focusedId: string | null;
  setFocusedId: (id: string | null) => void;
  searchState: SearchState;
  searchDispatch: Dispatch<SearchAction>;
} {
  // Selection
  const [selectedId, setSelectedIdRaw] = useState<string | null>(() => {
    const { sourceId } = parseHash(window.location.hash);
    return sourceId;
  });

  // Search state
  const [searchState, searchDispatch] = useSearchState(
    data.nodes,
    data.edges,
    settings.visibleTypes,
    selectedId
  );

  // Use a ref to access searchState in callbacks without re-creating them
  const searchStateRef = useRef(searchState);
  searchStateRef.current = searchState;

  useEffect(() => {
    // Ensure the path is rebuilt when the visible types change
    searchDispatch({ type: "path:rebuild" });
  }, [searchDispatch, settings.visibleTypes]);

  // Focus
  const [focusedId, setFocusedRawId] = useState<string | null>(null);
  const setFocusedId = useCallback(
    (id: string | null) => {
      if (id) {
        setFocusedRawId(id);
      } else if (selectedId) {
        setFocusedRawId(selectedId);
      } else {
        setFocusedRawId(null);
      }
    },
    [data, selectedId, setFocusedRawId]
  );

  // Wrapper function to handle updating selectedId, filter, focus, and title
  // This is used for graph clicks (direct source selection)
  const setSelectedId = useCallback(
    (newId: string | null) => {
      setSelectedIdRaw(newId);
      if (newId) {
        const nodeData = data.nodes[nodeIdToInt(newId)];
        searchDispatch({
          type: "select-node",
          nodeId: newId,
        });
        if (nodeData) {
          document.title = `genres in space: ${nodeData.label}`;
        }
      } else {
        searchDispatch({ type: "selected:clear-source" });
        document.title = "genres in space";
        if (window.location.hash) {
          window.history.pushState(null, "", window.location.pathname);
        }
      }
      setFocusedId(newId);
    },
    [data, setFocusedId, searchDispatch]
  );

  // Sync URL hash whenever search state or selectedId changes
  // Clearing the hash is handled imperatively in setSelectedId(null)
  useEffect(() => {
    if (searchState.type === "initial") return;

    const sourceId = searchState.sourceId;
    const destinationId =
      searchState.type === "path" ? searchState.destinationId : null;
    const newHash = buildHash(sourceId, destinationId, selectedId);

    if (window.location.hash !== newHash) {
      window.history.pushState(null, "", newHash);
    }
  }, [searchState, selectedId]);

  // Handle hash changes (browser back/forward, GenreLink clicks)
  useEffect(() => {
    const handleHashChange = () => {
      const {
        sourceId,
        destinationId,
        selectedId: hashSelectedId,
      } = parseHash(window.location.hash);
      const currentState = searchStateRef.current;

      if (sourceId && destinationId) {
        // Full path: #sourceId,destinationId[,selectedId]
        const effectiveSelectedId = hashSelectedId || sourceId;
        setSelectedIdRaw(effectiveSelectedId);
        const nodeData = data.nodes[nodeIdToInt(effectiveSelectedId)];
        if (nodeData) {
          document.title = `genres in space: ${nodeData.label}`;
        }
        setFocusedId(effectiveSelectedId);
        searchDispatch({
          type: "restore-path",
          sourceId,
          destinationId,
        });
      } else if (sourceId) {
        // Single node: #sourceId — use hash-navigate for context-aware behavior
        if (
          (currentState.type === "selected" || currentState.type === "path") &&
          currentState.sourceId !== sourceId
        ) {
          // In selected/path state with a different node — hash-navigate sets destination
          const currentSourceId = currentState.sourceId;
          // Keep selectedId as the current source (for graph focus)
          setSelectedIdRaw(currentSourceId);
          document.title = `genres in space: ${data.nodes[nodeIdToInt(currentSourceId)].label}`;
          setFocusedId(currentSourceId);
          searchDispatch({
            type: "hash-navigate",
            nodeId: sourceId,
          });
          // Update hash to reflect full path state
          const newHash = buildHash(currentSourceId, sourceId, currentSourceId);
          if (window.location.hash !== newHash) {
            window.history.replaceState(null, "", newHash);
          }
        } else {
          // In initial state, or same node as source — treat as source selection
          setSelectedIdRaw(sourceId);
          const nodeData = data.nodes[nodeIdToInt(sourceId)];
          if (nodeData) {
            document.title = `genres in space: ${nodeData.label}`;
          }
          setFocusedId(sourceId);
          searchDispatch({
            type: "hash-navigate",
            nodeId: sourceId,
          });
        }
      } else {
        // Empty hash — clear selection
        setSelectedIdRaw(null);
        document.title = "genres in space";
        setFocusedId(null);
        searchDispatch({ type: "selected:clear-source" });
      }
    };

    // Handle initial load
    handleHashChange();

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [setFocusedId, searchDispatch, data]);

  return {
    selectedId,
    setSelectedId,
    focusedId,
    setFocusedId,
    searchState,
    searchDispatch,
  };
}

/** The main app component */
export default App;
