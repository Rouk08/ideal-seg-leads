interface CheckboxGroupProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (values: T[]) => void;
}

export function CheckboxGroup<T extends string>({ label, options, selected, onChange }: CheckboxGroupProps<T>) {
  function toggle(value: T) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div className="field">
      <label>{label}</label>
      <div className="checkbox-grid">
        {options.map((opt) => (
          <label key={opt.value} className="checkbox-row">
            <input type="checkbox" checked={selected.includes(opt.value)} onChange={() => toggle(opt.value)} />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}
