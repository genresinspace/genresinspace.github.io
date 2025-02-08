import {
  Cosmograph,
  CosmographProvider,
  useCosmograph,
} from "@cosmograph/react";
import { useEffect, useState } from "react";
import {
  SimulationParams,
  SimulationControls,
  defaultSimulationParams,
} from "./SimulationParams";

type NodeData = {
  id: string;
  label: string;
  degree: number;
  inbound: string[];
  outbound: string[];
};

type LinkData = {
  source: string;
  target: string;
  ty: "Derivative" | "Subgenre" | "FusionGenre";
};

type Data = {
  nodes: NodeData[];
  links: LinkData[];
  max_degree: number;
};

const DERIVATIVE_COLOUR = "hsl(0, 70%, 60%)";
const SUBGENRE_COLOUR = "hsl(120, 70%, 60%)";
const FUSION_GENRE_COLOUR = "hsl(240, 70%, 60%)";

function Graph({
  params,
  maxDegree,
  selectedId,
  setSelectedId,
}: {
  params: SimulationParams;
  maxDegree: number;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}) {
  const { cosmograph } = useCosmograph<NodeData, LinkData>()!;
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(
    new Set()
  );

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
          let color = `hsl(${hue}, 70%, 60%)`;
          if (selectedId) {
            if (highlightedNodes.has(d.id)) {
              return color;
            } else {
              return "hsl(0, 0%, 60%)";
            }
          } else {
            return color;
          }
        }}
        linkColor={(d: LinkData) => {
          let color =
            d.ty === "Derivative"
              ? DERIVATIVE_COLOUR
              : d.ty === "Subgenre"
              ? SUBGENRE_COLOUR
              : FUSION_GENRE_COLOUR;

          if (selectedId) {
            if (d.source === selectedId || d.target === selectedId) {
              return color;
            } else {
              return "hsl(0, 0%, 20%)";
            }
          } else {
            return color;
          }
        }}
        nodeSize={(d: NodeData) => {
          return (
            8.0 * (0.2 + (d.degree / maxDegree) * 0.8) +
            1.0 * (selectedId && highlightedNodes.has(d.id) ? 1 : 0)
          );
        }}
        linkArrowsSizeScale={2}
        nodeLabelColor="#CCC"
        hoveredNodeLabelColor="#FFF"
        spaceSize={8192}
        {...params}
        randomSeed={"Where words fail, music speaks"}
        nodeGreyoutOpacity={1}
        linkGreyoutOpacity={1}
        onClick={(nodeData, _nodeIndex, _nodePosition) => {
          if (nodeData && selectedId !== nodeData.id) {
            cosmograph?.selectNode(nodeData, false);
            setSelectedId(nodeData.id);
            setHighlightedNodes(
              new Set([nodeData.id, ...nodeData.inbound, ...nodeData.outbound])
            );
          } else {
            cosmograph?.unselectNodes();
            setSelectedId(null);
            setHighlightedNodes(new Set());
          }
        }}
      />
    </div>
  );
}

function ProjectInformation() {
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {[
          {
            color: DERIVATIVE_COLOUR,
            label: "Derivative",
            description:
              "Genres that use some of the elements inherent to this genre, without being a child genre.",
          },
          {
            color: SUBGENRE_COLOUR,
            label: "Subgenre",
            description:
              "Genres that share characteristics with this genre and fall within its purview.",
          },
          {
            color: FUSION_GENRE_COLOUR,
            label: "Fusion Genre",
            description:
              "Genres that combine elements of this genre with other genres.",
          },
        ].map(({ color, label, description }) => (
          <div key={label}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  backgroundColor: color,
                }}
              />
              <span style={{ color }}>{label}</span>
            </div>
            <p style={{ marginTop: "0.5em" }}>{description}</p>
          </div>
        ))}
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
  const [activeTab, setActiveTab] = useState<"information" | "simulation">(
    "information"
  );

  return (
    <div className="sidebar">
      <div style={{ display: "flex", marginBottom: "16px" }}>
        <button
          style={{
            flex: 1,
            padding: "8px",
            background: activeTab === "information" ? "#333" : "#222",
            border: "none",
            color: "#CCC",
            cursor: "pointer",
          }}
          onClick={() => setActiveTab("information")}
        >
          Information
        </button>
        <button
          style={{
            flex: 1,
            padding: "8px",
            background: activeTab === "simulation" ? "#333" : "#222",
            border: "none",
            color: "#CCC",
            cursor: "pointer",
          }}
          onClick={() => setActiveTab("simulation")}
        >
          Simulation
        </button>
      </div>

      {activeTab === "information" ? (
        <ProjectInformation />
      ) : (
        <SimulationControls params={params} setParams={setParams} />
      )}
    </div>
  );
}

function App() {
  const [data, setData] = useState<Data>({
    nodes: [],
    links: [],
    max_degree: 0,
  });
  useEffect(() => {
    async function fetchData() {
      const response = await fetch("/data.json");
      const data = await response.json();
      setData(data);
    }
    fetchData();
  }, []);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [params, setParams] = useState<SimulationParams>(
    defaultSimulationParams
  );

  return (
    <div>
      <CosmographProvider nodes={data.nodes} links={data.links}>
        <Graph
          params={params}
          maxDegree={data.max_degree}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
        />
        <Sidebar params={params} setParams={setParams} />
      </CosmographProvider>
    </div>
  );
}

export default App;
