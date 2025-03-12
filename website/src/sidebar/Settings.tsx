import { useCosmograph } from "@cosmograph/react";

import {
  ControlDesc,
  GENERAL_CONTROLS,
  SIMULATION_CONTROLS,
} from "../Settings";
import { SettingsData } from "../Settings";

import {
  CheckboxInput,
  RangeInput,
  InputDescription,
} from "../components/Input";

/** Renders the settings sidebar. */
export function Settings({
  settings,
  setSettings,
}: {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
}) {
  const cosmographContext = useCosmograph();

  return (
    <div className="flex flex-col gap-4">
      <ControlSection
        name="General"
        sectionDesc={GENERAL_CONTROLS}
        settingsSection={settings.general}
        setSettingsSection={(value) => {
          setSettings({ ...settings, general: value });
        }}
      />
      <ControlSection
        name="Simulation"
        sectionDesc={SIMULATION_CONTROLS}
        settingsSection={settings.simulation}
        setSettingsSection={(value) => {
          setSettings({ ...settings, simulation: value });
          if (cosmographContext) {
            cosmographContext.cosmograph?.start();
          }
        }}
      />
    </div>
  );
}

/** Renders a section of controls. */
function ControlSection<
  SectionDesc extends ControlDesc,
  SectionData extends Record<string, any>
>({
  name,
  sectionDesc,
  settingsSection,
  setSettingsSection,
}: {
  name: string;
  sectionDesc: SectionDesc[];
  settingsSection: SectionData;
  setSettingsSection: (settingsSection: SectionData) => void;
}) {
  return (
    <section>
      <h2 className="text-xl font-extrabold">{name}</h2>
      <div className="flex flex-col gap-2">
        {sectionDesc.map((control) => (
          <Control
            key={control.name}
            control={control}
            param={settingsSection[control.name]}
            setParam={(value) => {
              setSettingsSection({
                ...settingsSection,
                [control.name]: value,
              });
            }}
          />
        ))}
      </div>
    </section>
  );
}

/** Renders a control for a setting. */
function Control<T>({
  control,
  param,
  setParam,
}: {
  control: ControlDesc;
  param: T;
  setParam: (param: T) => void;
}) {
  return (
    <InputDescription description={control.description}>
      {control.type === "number" ? (
        <NumberControl
          control={control}
          param={param as number}
          setParam={setParam as (param: number) => void}
        />
      ) : control.type === "boolean" ? (
        <CheckboxControl
          control={control}
          param={param as boolean}
          setParam={setParam as (param: boolean) => void}
        />
      ) : null}
    </InputDescription>
  );
}

/** Renders a `RangeInput` for a number control. */
function NumberControl({
  control,
  param,
  setParam,
}: {
  control: Extract<ControlDesc, { type: "number" }>;
  param: number;
  setParam: (param: number) => void;
}) {
  return (
    <RangeInput
      name={control.name}
      label={control.label}
      min={control.min}
      max={control.max}
      step={control.step}
      defaultValue={control.default}
      value={param || control.default}
      onChange={(_name, value) => setParam(value)}
    />
  );
}

/** Renders a `CheckboxInput` for a boolean control. */
function CheckboxControl({
  control,
  param,
  setParam,
}: {
  control: Extract<ControlDesc, { type: "boolean" }>;
  param: boolean;
  setParam: (param: boolean) => void;
}) {
  return (
    <CheckboxInput
      name={control.name}
      label={control.label}
      checked={param ?? control.default}
      onChange={(_name, checked) => setParam(checked)}
    />
  );
}
