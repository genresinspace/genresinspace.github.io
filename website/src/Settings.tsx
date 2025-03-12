import { useCosmograph } from "@cosmograph/react";
import {
  CheckboxInput,
  RangeInput,
  InputDescription,
} from "./components/Input";

export type Settings = {
  general: {
    zoomOnSelect: boolean;
    showLabels: boolean;
    maxInfluenceDistance: number;
    visibleTypes: {
      Derivative: boolean;
      Subgenre: boolean;
      FusionGenre: boolean;
    };
  };
  simulation: SimulationParams;
};

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

export function SettingsView({
  settings,
  setSettings,
}: {
  settings: Settings;
  setSettings: (settings: Settings) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section>
        <h2 className="text-xl font-extrabold">General</h2>
        <div className="flex flex-col gap-2">
          <InputDescription description="Whether or not to zoom / pan the graph upon selecting a node.">
            <CheckboxInput
              name="zoomOnSelect"
              label="Zoom on select"
              checked={settings.general.zoomOnSelect}
              onChange={(name, checked) =>
                setSettings({
                  ...settings,
                  general: {
                    ...settings.general,
                    [name]: checked,
                  },
                })
              }
            />
          </InputDescription>
          <InputDescription description="Whether or not to show labels on the graph.">
            <CheckboxInput
              name="showLabels"
              label="Show labels"
              checked={settings.general.showLabels}
              onChange={(name, checked) =>
                setSettings({
                  ...settings,
                  general: {
                    ...settings.general,
                    [name]: checked,
                  },
                })
              }
            />
          </InputDescription>
          <InputDescription description="When a node is selected, highlight nodes and connections that are up to this many steps away in the graph. Higher values show more of the network around the selected node.">
            <RangeInput
              name="maxInfluenceDistance"
              label="Maximum Influence Distance"
              min={1}
              max={5}
              step={1}
              defaultValue={1}
              value={settings.general.maxInfluenceDistance - 1}
              onChange={(_name, value) =>
                setSettings({
                  ...settings,
                  general: {
                    ...settings.general,
                    maxInfluenceDistance: value + 1,
                  },
                })
              }
            />
          </InputDescription>
        </div>
      </section>
      <section>
        <h2 className="text-xl font-extrabold">Simulation</h2>
        <SimulationControls
          params={settings.simulation}
          setParams={(params) =>
            setSettings({ ...settings, simulation: params })
          }
        />
      </section>
    </div>
  );
}

export function SimulationControls({
  params,
  setParams,
}: {
  params: SimulationParams;
  setParams: (params: SimulationParams) => void;
}) {
  const cosmographContext = useCosmograph();

  const handleChange = (name: string, value: number) => {
    setParams({
      ...params,
      [name]: value,
    });
    if (cosmographContext) {
      cosmographContext.cosmograph?.start();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {simulationControls.map((control) => (
        <InputDescription description={control.description} key={control.name}>
          <RangeInput
            name={control.name}
            label={control.label}
            min={control.min}
            max={control.max}
            step={control.step}
            defaultValue={control.default}
            value={params[control.name] ?? control.default}
            onChange={handleChange}
          />
        </InputDescription>
      ))}
    </div>
  );
}

type SimulationControl = {
  name: keyof SimulationParams;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  default: number;
};
const simulationControls: SimulationControl[] = [
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
    default: 1.0,
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
    default: 0.6,
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

export const DEFAULT_SETTINGS: Settings = {
  general: {
    zoomOnSelect: true,
    showLabels: true,
    maxInfluenceDistance: 3,
    visibleTypes: {
      Derivative: true,
      Subgenre: true,
      FusionGenre: true,
    },
  },
  simulation: Object.fromEntries(
    simulationControls.map((control) => [control.name, control.default])
  ) as SimulationParams,
};
