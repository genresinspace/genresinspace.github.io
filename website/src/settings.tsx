import { EdgeType } from "./data";

/** The settings for the app. Updated by the `Settings` component. */
export type SettingsData = {
  visibleTypes: VisibleTypes;
  general: {
    zoomOnSelect: boolean;
    showLabels: boolean;
    showMixes: boolean;
    autoplayMixes: boolean;
    maxInfluenceDistance: number;
    arrowSizeScale: number;
    experimentalPathfinding: boolean;
  };
};

/** The types of nodes that are visible in the graph. */
export type VisibleTypes = {
  [EdgeType.Derivative]: boolean;
  [EdgeType.Subgenre]: boolean;
  [EdgeType.FusionGenre]: boolean;
};

/** A description of a visible type. */
export type VisibleTypeDesc = {
  color: string;
  label: string;
  type: keyof VisibleTypes;
  description: string;
};

/** The colour of a derivative genre */
export const derivativeColour = (saturation: number = 70, alpha: number = 1) =>
  `hsla(0, ${saturation}%, 60%, ${alpha})`;

/** The colour of a subgenre */
export const subgenreColour = (saturation: number = 70, alpha: number = 1) =>
  `hsla(120, ${saturation}%, 60%, ${alpha})`;

/** The colour of a fusion genre */
export const fusionGenreColour = (saturation: number = 70, alpha: number = 1) =>
  `hsla(240, ${saturation}%, 60%, ${alpha})`;

/** Descriptions of the visible types in the graph */
export const VISIBLE_TYPES: VisibleTypeDesc[] = [
  {
    color: derivativeColour(),
    label: "Derivative",
    type: EdgeType.Derivative,
    description:
      "Genres that use some of the elements inherent to this genre, without being a subgenre.",
  },
  {
    color: subgenreColour(),
    label: "Subgenre",
    type: EdgeType.Subgenre,
    description:
      "Genres that share characteristics with this genre and fall within its purview.",
  },
  {
    color: fusionGenreColour(),
    label: "Fusion Genre",
    type: EdgeType.FusionGenre,
    description:
      "Genres that combine elements of this genre with other genres.",
  },
];

/** Map of visible type names to their descriptions */
export const VISIBLE_TYPES_BY_TYPE = Object.fromEntries(
  VISIBLE_TYPES.map((type) => [type.type, type])
) as Record<EdgeType, VisibleTypeDesc>;

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
    type: "boolean",
    name: "autoplayMixes",
    label: "Autoplay mixes",
    description: "Whether or not to autoplay mixes when a genre is selected.",
    default: false,
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
  {
    type: "number",
    name: "arrowSizeScale",
    label: "Arrow Size Scale",
    description: "The size of the arrows on the graph.",
    min: 0.5,
    max: 3,
    step: 0.1,
    default: 1.5,
  },
  {
    type: "boolean",
    name: "experimentalPathfinding",
    label: "Experimental Pathfinding",
    description:
      "I'm working on letting you find the path between two genres (i.e. all of the intermediate genres of influence between them). I'm still working on making it work well, but you can play around with it if you'd like.",
    default: false,
  },
];

/** The default settings for the app. */
export const DEFAULT_SETTINGS: SettingsData = {
  visibleTypes: {
    [EdgeType.Derivative]: true,
    [EdgeType.Subgenre]: true,
    [EdgeType.FusionGenre]: true,
  },
  general: Object.fromEntries(
    GENERAL_CONTROLS.map((control) => [control.name, control.default])
  ) as unknown as SettingsData["general"],
};
