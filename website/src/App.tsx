import {
  Cosmograph,
  CosmographProvider,
  useCosmograph,
} from "@cosmograph/react";
import { useEffect, useRef, useState } from "react";
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
  dump_date: string;
};

const derivativeColour = (saturation: number = 70) =>
  `hsl(0, ${saturation}%, 60%)`;
const subgenreColour = (saturation: number = 70) =>
  `hsl(120, ${saturation}%, 60%)`;
const fusionGenreColour = (saturation: number = 70) =>
  `hsl(240, ${saturation}%, 60%)`;

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
  const { cosmograph, nodes } = useCosmograph<NodeData, LinkData>()!;
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    // There's probably a faster way of doing this, but we're only searching a ~thousand nodes, so...
    const nodeData = nodes?.find((n) => n.id === selectedId);
    if (nodeData) {
      cosmograph?.selectNode(nodeData, false);
      setHighlightedNodes(
        new Set([nodeData.id, ...nodeData.inbound, ...nodeData.outbound])
      );
    } else {
      cosmograph?.unselectNodes();
      setHighlightedNodes(new Set());
    }
  }, [selectedId]);

  return (
    <div className="flex-1 h-full">
      <Cosmograph
        disableSimulation={false}
        nodeLabelAccessor={(d: NodeData) => d.label}
        nodeColor={(d) => {
          const hash = d.id
            .split("")
            .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0);
          const hue = Math.abs(hash % 360);
          let color = `hsl(${hue}, ${
            ((d.degree / maxDegree) * 0.8 + 0.2) * 100
          }%, 60%)`;
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
          let color = (saturation: number) =>
            d.ty === "Derivative"
              ? derivativeColour(saturation)
              : d.ty === "Subgenre"
              ? subgenreColour(saturation)
              : fusionGenreColour(saturation);
          if (selectedId) {
            if (d.source === selectedId) {
              return color(90);
            } else if (d.target === selectedId) {
              return color(40);
            } else {
              return "hsla(0, 0%, 20%, 0.1)";
            }
          } else {
            return color(70);
          }
        }}
        nodeSize={(d: NodeData) => {
          return (
            8.0 * (0.2 + (d.degree / maxDegree) * 0.8) +
            1.0 * (selectedId && !highlightedNodes.has(d.id) ? -1 : 0)
          );
        }}
        linkWidth={(d: LinkData) => {
          if (selectedId) {
            if (d.source === selectedId) {
              return 2.5;
            } else if (d.target === selectedId) {
              return 1.5;
            }
          }
          return 1;
        }}
        linkArrowsSizeScale={2}
        nodeLabelColor="#CCC"
        hoveredNodeLabelColor="#FFF"
        spaceSize={8192}
        {...params}
        randomSeed={"Where words fail, music speaks"}
        nodeGreyoutOpacity={1}
        linkGreyoutOpacity={1}
        linkVisibilityMinTransparency={selectedId ? 0.75 : 0.25}
        onClick={(nodeData, _nodeIndex, _nodePosition) => {
          setSelectedId(
            nodeData && selectedId !== nodeData.id ? nodeData.id : null
          );
        }}
      />
    </div>
  );
}

function ProjectInformation({ dumpDate }: { dumpDate: string }) {
  return (
    <div>
      <div className="flex flex-col gap-2">
        {[
          {
            color: derivativeColour(),
            label: "Derivative",
            description:
              "Genres that use some of the elements inherent to this genre, without being a child genre.",
          },
          {
            color: subgenreColour(),
            label: "Subgenre",
            description:
              "Genres that share characteristics with this genre and fall within its purview.",
          },
          {
            color: fusionGenreColour(),
            label: "Fusion Genre",
            description:
              "Genres that combine elements of this genre with other genres.",
          },
        ].map(({ color, label, description }) => (
          <div key={label}>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5" style={{ backgroundColor: color }} />
              <span style={{ color }}>{label}</span>
            </div>
            <p className="mt-2">{description}</p>
          </div>
        ))}
        <hr />
        <p>
          A graph of every music genre on English Wikipedia (as of{" "}
          <a
            href={`https://dumps.wikimedia.org/enwiki/${dumpDate
              .split("-")
              .join("")}/`}
          >
            {dumpDate}
          </a>
          ), inspired by <a href="https://eightyeightthirty.one/">8831</a> and{" "}
          <a href="https://musicmap.info/">musicmap</a>.
        </p>
        <p>
          By <a href="https://philpax.me">Philpax</a>. Powered by{" "}
          <a href="https://cosmograph.app/">Cosmograph</a>.
        </p>
        <p>
          <a href="https://github.com/graphgenre/graphgenre.github.io">
            Source code
          </a>
          .{" "}
          <a href="https://upload.wikimedia.org/wikipedia/commons/1/19/Under_construction_graphic.gif">
            Blog post
          </a>
          , if you're curious.
        </p>
      </div>
    </div>
  );
}

function SelectedNodeInfo({
  selectedId,
  setSelectedId,
  nodes,
}: {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  nodes: NodeData[];
}) {
  if (!selectedId) {
    return <p>No node selected</p>;
  }

  const node = nodes.find((n) => n.id === selectedId);
  if (!node) return null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold">{node.label}</h2>
      {[
        { title: "Inbound Connections", ids: node.inbound },
        { title: "Outbound Connections", ids: node.outbound },
      ].map(({ title, ids }) => (
        <div key={title}>
          <h3 className="text-lg font-semibold mb-2">{title}</h3>
          <ul className="list-disc pl-5">
            {ids.map((id) => {
              const linkedNode = nodes.find((n) => n.id === id);
              return (
                <li key={id}>
                  <button
                    className="text-blue-400 hover:underline text-left"
                    onClick={() => setSelectedId(id)}
                  >
                    {linkedNode?.label || id}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Sidebar({
  params,
  setParams,
  dumpDate,
  setSelectedId,
  selectedId,
  nodes,
}: {
  params: SimulationParams;
  setParams: (params: SimulationParams) => void;
  dumpDate: string;
  setSelectedId: (id: string | null) => void;
  selectedId: string | null;
  nodes: NodeData[];
}) {
  const [activeTab, setActiveTab] = useState<
    "information" | "selected" | "simulation"
  >("information");
  const [width, setWidth] = useState("20%");
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = window.innerWidth - e.clientX;
      const minWidth = 300;
      const maxWidth = window.innerWidth * 0.4; // 40% max width

      setWidth(`${Math.min(Math.max(newWidth, minWidth), maxWidth)}px`);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    if (selectedId) {
      setActiveTab("selected");
    }
  }, [selectedId]);

  return (
    <div
      ref={sidebarRef}
      style={{ width, userSelect: isResizing ? "none" : "auto" }}
      className="h-full bg-neutral-900 text-white p-5 box-border overflow-y-auto relative"
    >
      <div
        className="absolute top-0 bottom-0 left-0 w-4 cursor-ew-resize hover:bg-neutral-700"
        onMouseDown={() => setIsResizing(true)}
      />
      <div className="flex mb-4">
        <button
          className={`flex-1 p-2 border-none text-neutral-300 cursor-pointer ${
            activeTab === "information" ? "bg-neutral-800" : "bg-neutral-800/50"
          }`}
          onClick={() => setActiveTab("information")}
        >
          Info
        </button>
        <button
          className={`flex-1 p-2 border-none text-neutral-300 cursor-pointer ${
            activeTab === "selected" ? "bg-neutral-800" : "bg-neutral-800/50"
          }`}
          onClick={() => setActiveTab("selected")}
        >
          Selected
        </button>
        <button
          className={`flex-1 p-2 border-none text-neutral-300 cursor-pointer ${
            activeTab === "simulation" ? "bg-neutral-800" : "bg-neutral-800/50"
          }`}
          onClick={() => setActiveTab("simulation")}
        >
          Sim
        </button>
      </div>
      {activeTab === "information" ? (
        <ProjectInformation dumpDate={dumpDate} />
      ) : activeTab === "selected" ? (
        <SelectedNodeInfo
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          nodes={nodes}
        />
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
    dump_date: "",
  });
  useEffect(() => {
    async function fetchData() {
      const response = await fetch("/data.json");
      const data = await response.json();
      setData(data);
    }
    fetchData();
  }, []);

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const hash = window.location.hash.slice(1);
    return hash || null;
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      setSelectedId(hash || null);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (selectedId) {
      if (window.location.hash !== `#${selectedId}`) {
        window.history.pushState(null, "", `#${selectedId}`);
      }
    } else if (window.location.hash) {
      window.history.pushState(null, "", window.location.pathname);
    }
  }, [selectedId]);

  const [params, setParams] = useState<SimulationParams>(
    defaultSimulationParams
  );

  return (
    <div className="flex w-screen h-screen">
      <CosmographProvider nodes={data.nodes} links={data.links}>
        <Graph
          params={params}
          maxDegree={data.max_degree}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
        />
        <Sidebar
          params={params}
          setParams={setParams}
          dumpDate={data.dump_date}
          setSelectedId={setSelectedId}
          selectedId={selectedId}
          nodes={data.nodes}
        />
      </CosmographProvider>
    </div>
  );
}

export default App;
