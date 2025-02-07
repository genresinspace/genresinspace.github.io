import { Cosmograph, CosmographProvider } from "@cosmograph/react";
import { useEffect, useState } from "react";

type NodeData = {
  id: string;
  label: string;
};

type LinkData = {
  source: string;
  target: string;
  ty: "Derivative" | "Subgenre" | "FusionGenre";
};

type SimulationParams = {
  simulationDecay?: number | undefined;
  simulationGravity?: number | undefined;
  simulationCenter?: number | undefined;
  simulationRepulsion?: number | undefined;
  simulationRepulsionTheta?: number | undefined;
  simulationLinkSpring?: number | undefined;
  simulationLinkDistance?: number | undefined;
  simulationRepulsionFromMouse?: number | undefined;
  simulationFriction?: number | undefined;
};
interface SimulationControl {
  name: keyof SimulationParams;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

const simulationControls: SimulationControl[] = [
  {
    name: "simulationRepulsion",
    label: "Repulsion Force",
    description:
      "Controls the repulsion force coefficient, determining the strength of node repulsion. Increase for stronger repulsion, decrease for weaker repulsion.",
    min: 0,
    max: 2,
    step: 0.1,
    default: 0.1,
  },
  {
    name: "simulationRepulsionTheta",
    label: "Repulsion Detail",
    description:
      "Controls the level of detail in Many-Body force calculations. Higher values provide more accurate calculations, while lower values give faster but less precise results.",
    min: 0.3,
    max: 2,
    step: 0.1,
    default: 1.7,
  },
  {
    name: "simulationLinkSpring",
    label: "Link Spring Force",
    description:
      "Adjusts the link spring force coefficient, determining the strength of attraction between connected nodes. Increase for stronger attraction, decrease for weaker attraction.",
    min: 0,
    max: 2,
    step: 0.1,
    default: 1.0,
  },
  {
    name: "simulationLinkDistance",
    label: "Link Distance",
    description:
      "Defines the minimum distance between linked nodes, affecting their positioning. Increase for more spacing, decrease for closer proximity.",
    min: 1,
    max: 20,
    step: 1,
    default: 2,
  },
  {
    name: "simulationGravity",
    label: "Gravity",
    description:
      "Adjusts the gravity force coefficient, determining how much nodes are attracted towards the center of the graph. Increase for stronger gravitational pull towards the center, decrease for weaker attraction.",
    min: 0,
    max: 1,
    step: 0.1,
    default: 0,
  },
  {
    name: "simulationCenter",
    label: "Center Force",
    description:
      "Changes the centering force coefficient, pulling nodes towards the center of the graph. Increase for more centered nodes, decrease for less centralization.",
    min: 0,
    max: 1,
    step: 0.1,
    default: 0,
  },
  {
    name: "simulationFriction",
    label: "Friction",
    description:
      "Controls the friction coefficient, affecting how much nodes slow down over time. Higher values result in slower movement and longer simulation time, lower values allow faster movement and quicker convergence.",
    min: 0.8,
    max: 1,
    step: 0.01,
    default: 0.85,
  },
  {
    name: "simulationDecay",
    label: "Decay",
    description:
      'Controls the force simulation decay coefficient. Higher values make the simulation "cool down" slower. Increase for a longer-lasting simulation, decrease for a faster decay.',
    min: 100,
    max: 10000,
    step: 100,
    default: 1000,
  },
  {
    name: "simulationRepulsionFromMouse",
    label: "Mouse Repulsion",
    description:
      "Sets the repulsion force coefficient from the mouse cursor. Activates the repulsion force when the right mouse button is pressed. Increase for stronger repulsion from the cursor click, decrease for weaker repulsion.",
    min: 0,
    max: 5,
    step: 0.1,
    default: 2,
  },
];

function SimulationControls({
  params,
  setParams,
}: {
  params: SimulationParams;
  setParams: (params: SimulationParams) => void;
}) {
  return (
    <div className="simulation-controls">
      {simulationControls.map((control) => (
        <div key={control.name} className="control-group">
          <label title={control.description}>{control.label}</label>
          <input
            type="range"
            min={control.min}
            max={control.max}
            step={control.step}
            value={params[control.name] ?? control.default}
            onChange={(e) => {
              setParams({
                ...params,
                [control.name]: parseFloat(e.target.value),
              });
            }}
          />
          <span className="value">
            {params[control.name] ?? control.default}
          </span>
          <p className="description">{control.description}</p>
        </div>
      ))}
    </div>
  );
}

function Graph({
  data,
  params,
}: {
  data: { nodes: NodeData[]; links: LinkData[] };
  params: SimulationParams;
}) {
  return (
    <div className="graph">
      <CosmographProvider nodes={data.nodes} links={data.links}>
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
          linkColor={(d) => {
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
      </CosmographProvider>
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
    Object.fromEntries(
      simulationControls.map((control) => [control.name, control.default])
    ) as SimulationParams
  );

  return (
    <div>
      <Graph data={data} params={params} />
      <Sidebar params={params} setParams={setParams} />
    </div>
  );
}

export default App;
