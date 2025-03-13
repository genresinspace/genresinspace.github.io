/** Wraps an input and shows a description below it */
export function InputDescription({
  children,
  className,
  description,
}: {
  children: React.ReactNode;
  className?: string;
  description: string;
}) {
  return (
    <div className={`${className || ""}`}>
      {children}
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </div>
  );
}

/** A checkbox input with a label and a reset button */
export function CheckboxInput({
  name,
  label,
  checked,
  defaultValue,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  defaultValue: boolean;
  onChange: (name: string, checked: boolean) => void;
}) {
  return (
    <div className="flex flex-col space-y-1">
      <div className="flex justify-between items-center">
        <label className="block font-bold">{label}</label>
        <button
          type="button"
          className="text-sm px-2 py-1 bg-amber-700 rounded-md text-gray-200 hover:bg-amber-600"
          onClick={() => onChange(name, defaultValue)}
          aria-label="Reset to default"
        >
          ↺
        </button>
      </div>
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={checked}
          onChange={(e) => onChange(name, e.target.checked)}
        />
        <span className="text-sm">{checked ? "Yes" : "No"}</span>
      </div>
    </div>
  );
}

/** A range input with a label and a reset button */
export function RangeInput({
  name,
  label,
  min,
  max,
  step,
  defaultValue,
  value,
  onChange,
}: {
  name: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  value: number;
  onChange: (name: string, value: number) => void;
}) {
  return (
    <div className="flex flex-col space-y-1">
      <div className="flex justify-between items-center gap-2">
        <label className="block font-bold">{label}</label>
        <div className="flex items-center">
          <span className="text-sm font-medium px-2 py-1 bg-gray-700 rounded-l-md text-gray-200">
            {value ?? defaultValue}
          </span>
          <button
            type="button"
            className="text-sm font-medium px-2 py-1 bg-amber-700 rounded-r-md text-gray-200 hover:bg-amber-600"
            onClick={() => onChange(name, defaultValue)}
            aria-label="Reset to default"
          >
            ↺
          </button>
        </div>
      </div>
      <input
        type="range"
        className="w-full"
        min={min}
        max={max}
        step={step}
        value={value ?? defaultValue}
        onChange={(e) => {
          onChange(name, parseFloat(e.target.value));
        }}
      />
    </div>
  );
}
