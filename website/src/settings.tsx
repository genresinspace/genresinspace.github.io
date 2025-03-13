/** The settings for the app. Updated by the `Settings` component. */
export type SettingsData = {
  visibleTypes: {
    Derivative: boolean;
    Subgenre: boolean;
    FusionGenre: boolean;
  };
  general: {
    zoomOnSelect: boolean;
    showLabels: boolean;
    showMixes: boolean;
    maxInfluenceDistance: number;
  };
  simulation: SimulationParams;
};

/** The parameters for the simulation. */
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

/** A description (metadata) for a settings control. */
export type ControlDesc = {
  name: string;
  label: string;
  description: string;
} & (
  | {
      type: "number";
      min: number;
      max: number;
      step: number;
      default: number;
    }
  | {
      type: "boolean";
      default: boolean;
    }
);

/** A description for a general settings control. */
export type GeneralControlDesc = ControlDesc & {
  name: keyof SettingsData["general"];
};
/** The general settings controls. */
export const GENERAL_CONTROLS: GeneralControlDesc[] = [
  {
    type: "boolean",
    name: "zoomOnSelect",
    label: "Zoom on select",
    description:
      "Whether or not to zoom / pan the graph upon selecting a node.",
    default: true,
  },
  {
    type: "boolean",
    name: "showLabels",
    label: "Show labels",
    description: "Whether or not to show labels on the graph.",
    default: true,
  },
  {
    type: "boolean",
    name: "showMixes",
    label: "Show mixes",
    description: "Whether or not to show mixes for each genre.",
    default: true,
  },
  {
    type: "number",
    name: "maxInfluenceDistance",
    label: "Maximum Influence Distance",
    description:
      "When a node is selected, highlight nodes and connections that are up to this many steps away in the graph. Higher values show more of the network around the selected node.",
    min: 1,
    max: 5,
    step: 1,
    default: 2,
  },
];

/** A description for a simulation settings control. */
export type SimulationControlDesc = ControlDesc & {
  name: keyof SimulationParams;
};
/** The simulation settings controls. */
export const SIMULATION_CONTROLS: SimulationControlDesc[] = [
  {
    type: "number",
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
    type: "number",
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
    type: "number",
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
    type: "number",
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
    type: "number",
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
    type: "number",
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
    type: "number",
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
    type: "number",
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

/** The default settings for the app. */
export const DEFAULT_SETTINGS: SettingsData = {
  visibleTypes: {
    Derivative: true,
    Subgenre: true,
    FusionGenre: true,
  },
  general: Object.fromEntries(
    GENERAL_CONTROLS.map((control) => [control.name, control.default])
  ) as unknown as SettingsData["general"],
  simulation: Object.fromEntries(
    SIMULATION_CONTROLS.map((control) => [control.name, control.default])
  ) as SimulationParams,
};
