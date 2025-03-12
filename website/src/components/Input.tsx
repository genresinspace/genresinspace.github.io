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

export function CheckboxInput({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: (name: string, checked: boolean) => void;
}) {
  return (
    <div className="flex flex-col space-y-1">
      <label className="block font-bold">{label}</label>
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
        <span className="text-sm font-medium px-2 py-1 bg-gray-700 rounded-md text-gray-200">
          {value ?? defaultValue}
        </span>
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
