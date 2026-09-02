import type { SelectHTMLAttributes } from 'react';

interface Option {
  value: string;
  label: string;
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Option[];
  placeholder?: string;
  error?: string;
}

export function SelectField({ label, options, placeholder, error, id, ...rest }: SelectFieldProps) {
  const fieldId = id ?? `field-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <select id={fieldId} {...rest}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}
