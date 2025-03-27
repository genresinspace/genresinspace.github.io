import { CosmographProvider } from "@cosmograph/react";

import { useEffect, useState, useCallback } from "react";

import { Graph } from "./Graph";
import { Search } from "./Search";
import { DEFAULT_SETTINGS, SettingsData } from "./settings";
import { Data, nodeIdToInt, DataContext } from "./data";

import { Sidebar } from "./sidebar/Sidebar";

/** The main app component */
function App() {
  const loading = useData();

  if (loading.state === "loading") {
    return (
      <div className="flex w-screen h-screen items-center justify-center bg-neutral-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-neutral-600 border-t-white rounded-full animate-spin" />
          {loading.progress > 0 && (
            <div>Loading... {Math.round(loading.progress * 100)}%</div>
          )}
        </div>
      </div>
    );
  } else {
    return <LoadedApp data={loading.data} />;
  }
}

function useData():
  | { state: "loading"; progress: number }
  | { state: "loaded"; data: Data } {
  const [data, setData] = useState<Data | undefined>();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/data.json");
        const reader = response.body?.getReader();
        const contentLength = +(response.headers.get("Content-Length") ?? 0);

        if (!reader) {
          const data = await response.json();
          setData(data);
          return;
        }

        let receivedLength = 0;
        const chunks = [];

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          chunks.push(value);
          receivedLength += value.length;

          setProgress(
            Math.min(1, contentLength ? receivedLength / contentLength : 0)
          );
        }

        const chunksAll = new Uint8Array(receivedLength);
        let position = 0;
        for (const chunk of chunks) {
          chunksAll.set(chunk, position);
          position += chunk.length;
        }

        const result = new TextDecoder("utf-8").decode(chunksAll);
        const data = JSON.parse(result);
        setData(data);
      } catch (error) {
        console.error("Error loading data:", error);
      }
    }
    fetchData();
  }, []);

  if (!data) {
    return { state: "loading", progress };
  } else {
    return { state: "loaded", data };
  }
}

function LoadedApp({ data }: { data: Data }) {
  const {
    selectedId,
    setSelectedId,
    filter,
    setFilter,
    focusedId,
    setFocusedId,
  } = useSelectedIdAndFilterAndFocus(data);

  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);

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
            />
            <div className="absolute top-4 left-4 z-50 w-sm text-white">
              <Search
                selectedId={selectedId}
                setFocusedId={setFocusedId}
                filter={filter}
                setFilter={setFilter}
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

function useSelectedIdAndFilterAndFocus(data: Data): {
  selectedId: string | null;
  setSelectedId: (newId: string | null) => void;
  filter: string;
  setFilter: (filter: string) => void;
  focusedId: string | null;
  setFocusedId: (id: string | null) => void;
} {
  // Selection
  const [selectedId, setSelectedIdRaw] = useState<string | null>(() => {
    const hash = window.location.hash.slice(1);
    return hash || null;
  });

  // Filter
  const [filter, setFilter] = useState("");

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
        if (nodeData) {
          setFilter(nodeData.label);
          document.title = `genres in space: ${nodeData.label}`;
        }
      } else {
        setFilter("");
        document.title = "genres in space";
      }
      setFocusedId(newId);

      if (newId && window.location.hash !== `#${newId}`) {
        window.history.pushState(null, "", `#${newId}`);
      } else if (!newId && window.location.hash) {
        window.history.pushState(null, "", window.location.pathname);
      }
    },
    [data, setFocusedId]
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
    filter,
    setFilter,
    focusedId,
    setFocusedId,
  };
}

/** The main app component */
export default App;
