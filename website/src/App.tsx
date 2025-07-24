import { CosmographProvider } from "@cosmograph/react";

import { useEffect, useState, useCallback, Dispatch } from "react";

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

import { Sidebar } from "./views/sidebar/Sidebar";
import { DataCache, DataCacheContext } from "./services/dataCache";
import { colourStyles } from "../../colours";

import "./tailwind.css";

// Global constant for arrow key navigation (developer tool)
const ENABLE_ARROW_KEY_NAVIGATION = import.meta.env.DEV;

/** The main app component */
function App() {
  const loading = useData();
  const [dataCache] = useState(() => new DataCache());

  if (loading.state === "loading") {
    return (
      <div
        className={`flex w-screen h-screen items-center justify-center ${colourStyles.app.background} text-white`}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-neutral-600 border-t-white rounded-full animate-spin" />
          <div>Loading...</div>
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
    searchState,
    searchDispatch,
  } = useSelectedIdAndFilterAndFocus(data, settings);

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

  return (
    <DataContext.Provider value={data}>
      <div className="flex w-screen h-screen">
        <CosmographProvider nodes={data.nodes} links={data.edges}>
          <div className="flex-1 h-full relative">
            <Graph
              settings={settings}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              focusedId={focusedId}
              path={searchState.type === "path" ? searchState.path : null}
            />
            <div className="absolute top-4 left-4 z-50 w-sm text-white">
              <Search
                selectedId={selectedId}
                setFocusedId={setFocusedId}
                searchState={searchState}
                searchDispatch={searchDispatch}
                visibleTypes={settings.visibleTypes}
                setSelectedId={setSelectedId}
                experimentalPathfinding={
                  settings.general.experimentalPathfinding
                }
              />
            </div>
          </div>
          <Sidebar
            settings={settings}
            setSettings={setSettings}
            selectedId={selectedId}
            setFocusedId={setFocusedId}
          />
        </CosmographProvider>
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
    const hash = window.location.hash.slice(1);
    return hash || null;
  });

  // Search state
  const [searchState, searchDispatch] = useSearchState(
    data.nodes,
    data.edges,
    settings.visibleTypes,
    selectedId,
    settings.general.experimentalPathfinding
  );

  useEffect(() => {
    // Ensure the path is rebuilt when the visible types change
    searchDispatch({ type: "path:rebuild" });
  }, [
    searchDispatch,
    settings.visibleTypes,
    settings.general.experimentalPathfinding,
  ]);

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
      }
      setFocusedId(newId);

      if (newId && window.location.hash !== `#${newId}`) {
        window.history.pushState(null, "", `#${newId}`);
      } else if (!newId && window.location.hash) {
        window.history.pushState(null, "", window.location.pathname);
      }
    },
    [data, setFocusedId, searchDispatch]
  );

  // Handle hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      setSelectedId(hash || null);
    };

    // Handle initial load
    handleHashChange();

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [setSelectedId]);

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
