import { useCosmograph } from "@cosmograph/react";

export type SimulationParams = {
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

export const simulationControls: SimulationControl[] = [
  {
    name: "simulationRepulsion",
    label: "Repulsion Force",
    description:
      "Controls the repulsion force coefficient, determining the strength of node repulsion. Increase for stronger repulsion, decrease for weaker repulsion.",
    min: 0,
    max: 2,
    step: 0.1,
    default: 2,
  },
  {
    name: "simulationRepulsionTheta",
    label: "Repulsion Detail",
    description:
      "Controls the level of detail in Many-Body force calculations. Higher values provide more accurate calculations, while lower values give faster but less precise results.",
    min: 0.3,
    max: 2,
    step: 0.1,
    default: 0.3,
  },
  {
    name: "simulationLinkSpring",
    label: "Link Spring Force",
    description:
      "Adjusts the link spring force coefficient, determining the strength of attraction between connected nodes. Increase for stronger attraction, decrease for weaker attraction.",
    min: 0,
    max: 2,
    step: 0.1,
    default: 0.3,
  },
  {
    name: "simulationLinkDistance",
    label: "Link Distance",
    description:
      "Defines the minimum distance between linked nodes, affecting their positioning. Increase for more spacing, decrease for closer proximity.",
    min: 1,
    max: 20,
    step: 1,
    default: 8,
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
    default: 500,
  },
];

export const defaultSimulationParams: SimulationParams = Object.fromEntries(
  simulationControls.map((control) => [control.name, control.default])
) as SimulationParams;

export function SimulationControls({
  params,
  setParams,
}: {
  params: SimulationParams;
  setParams: (params: SimulationParams) => void;
}) {
  const cosmographContext = useCosmograph();

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
              if (cosmographContext) {
                cosmographContext.cosmograph?.start();
              }
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
