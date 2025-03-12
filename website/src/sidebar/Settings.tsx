import { useCosmograph } from "@cosmograph/react";

import { SIMULATION_CONTROLS, SimulationParams } from "../Settings";
import { SettingsData } from "../Settings";

import {
  CheckboxInput,
  RangeInput,
  InputDescription,
} from "../components/Input";

export function Settings({
  settings,
  setSettings,
}: {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
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
      {SIMULATION_CONTROLS.map((control) => (
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
