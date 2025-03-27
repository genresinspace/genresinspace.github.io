import { useCosmograph } from "@cosmograph/react";

import {
  ControlDesc,
  GENERAL_CONTROLS,
  SIMULATION_CONTROLS,
} from "../../settings";
import { SettingsData } from "../../settings";

import {
  CheckboxInput,
  RangeInput,
  InputDescription,
} from "../components/Input";
import { SectionHeading } from "../components/SectionHeading";

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
    <div className="flex flex-col gap-6">
      <ControlSection
        name="General"
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        }
        sectionDesc={GENERAL_CONTROLS}
        settingsSection={settings.general}
        setSettingsSection={(value) => {
          setSettings({ ...settings, general: value });
        }}
      />
      <ControlSection
        name="Simulation"
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
            />
          </svg>
        }
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
  SectionData extends Record<string, unknown>,
>({
  name,
  icon,
  sectionDesc,
  settingsSection,
  setSettingsSection,
}: {
  name: string;
  icon: React.ReactNode;
  sectionDesc: SectionDesc[];
  settingsSection: SectionData;
  setSettingsSection: (settingsSection: SectionData) => void;
}) {
  return (
    <section className="space-y-3">
      <SectionHeading icon={icon}>{name}</SectionHeading>
      <div className="flex flex-col gap-3">
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
    <div className="border-b border-neutral-700 pb-3 last:border-0 last:pb-0">
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
    </div>
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
      checked={param}
      defaultValue={control.default}
      onChange={(_name, checked) => setParam(checked)}
    />
  );
}
