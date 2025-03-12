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
    <div className={className}>
      {children}
      <p className="description">{description}</p>
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
    <div>
      <label className="block font-bold">{label}</label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(name, e.target.checked)}
      />
      <span className="value">{checked ? "Yes" : "No"}</span>
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
    <div>
      <label className="block font-bold">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value ?? defaultValue}
        onChange={(e) => {
          onChange(name, parseFloat(e.target.value));
        }}
      />
      <span className="value">{value ?? defaultValue}</span>
    </div>
  );
}
