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
            ? "hsl(0, 70%, 60%)"
            : d.ty === "Subgenre"
            ? "hsl(120, 70%, 60%)"
            : "hsl(240, 70%, 60%)";
        }}
        nodeSize={0.5}
        linkWidth={2}
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

function Sidebar({
  params,
  setParams,
}: {
  params: SimulationParams;
  setParams: (params: SimulationParams) => void;
}) {
  return (
    <div className="sidebar">
      <SimulationControls params={params} setParams={setParams} />
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
