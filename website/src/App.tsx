import { Cosmograph, CosmographProvider } from "@cosmograph/react";
import { useEffect, useState } from "react";
import {
  SimulationParams,
  SimulationControls,
  defaultSimulationParams,
} from "./SimulationParams";

type NodeData = {
  id: string;
  label: string;
};

type LinkData = {
  source: string;
  target: string;
  ty: "Derivative" | "Subgenre" | "FusionGenre";
};

const DERIVATIVE_COLOUR = "hsl(0, 70%, 60%)";
const SUBGENRE_COLOUR = "hsl(120, 70%, 60%)";
const FUSION_GENRE_COLOUR = "hsl(240, 70%, 60%)";

function Graph({ params }: { params: SimulationParams }) {
  return (
    <div className="graph">
      <Cosmograph
        disableSimulation={false}
        nodeLabelAccessor={(d: NodeData) => d.label}
        nodeColor={(d) => {
          const hash = d.id
            .split("")
            .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0);
          const hue = Math.abs(hash % 360);
          return `hsl(${hue}, 70%, 60%)`;
        }}
        linkColor={(d: LinkData) => {
          return d.ty === "Derivative"
            ? DERIVATIVE_COLOUR
            : d.ty === "Subgenre"
            ? SUBGENRE_COLOUR
            : FUSION_GENRE_COLOUR;
        }}
        nodeSize={0.5}
        linkArrowsSizeScale={2}
        nodeLabelColor="#CCC"
        hoveredNodeLabelColor="#FFF"
        spaceSize={8192}
        {...params}
        randomSeed={"Where words fail, music speaks"}
      />
    </div>
  );
}

function NodeSidebar() {
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "20px",
              height: "20px",
              backgroundColor: DERIVATIVE_COLOUR,
            }}
          />
          <span style={{ color: DERIVATIVE_COLOUR }}>Derivative</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "20px",
              height: "20px",
              backgroundColor: SUBGENRE_COLOUR,
            }}
          />
          <span style={{ color: SUBGENRE_COLOUR }}>Subgenre</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "20px",
              height: "20px",
              backgroundColor: FUSION_GENRE_COLOUR,
            }}
          />
          <span style={{ color: FUSION_GENRE_COLOUR }}>Fusion Genre</span>
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  params,
  setParams,
}: {
  params: SimulationParams;
  setParams: (params: SimulationParams) => void;
}) {
  const [activeTab, setActiveTab] = useState<"legend" | "controls">("legend");

  return (
    <div className="sidebar">
      <div style={{ display: "flex", marginBottom: "16px" }}>
        <button
          style={{
            flex: 1,
            padding: "8px",
            background: activeTab === "legend" ? "#333" : "#222",
            border: "none",
            color: "#CCC",
            cursor: "pointer",
          }}
          onClick={() => setActiveTab("legend")}
        >
          Legend
        </button>
        <button
          style={{
            flex: 1,
            padding: "8px",
            background: activeTab === "controls" ? "#333" : "#222",
            border: "none",
            color: "#CCC",
            cursor: "pointer",
          }}
          onClick={() => setActiveTab("controls")}
        >
          Controls
        </button>
      </div>

      {activeTab === "legend" ? (
        <NodeSidebar />
      ) : (
        <SimulationControls params={params} setParams={setParams} />
      )}
    </div>
  );
}

function App() {
  const [data, setData] = useState<{ nodes: NodeData[]; links: LinkData[] }>({
    nodes: [],
    links: [],
  });
  useEffect(() => {
    async function fetchData() {
      const response = await fetch("/data.json");
      const data = await response.json();
      setData(data);
    }
    fetchData();
  }, []);

  const [params, setParams] = useState<SimulationParams>(
    defaultSimulationParams
  );

  return (
    <div>
      <CosmographProvider nodes={data.nodes} links={data.links}>
        <Graph params={params} />
        <Sidebar params={params} setParams={setParams} />
      </CosmographProvider>
    </div>
  );
}

export default App;
