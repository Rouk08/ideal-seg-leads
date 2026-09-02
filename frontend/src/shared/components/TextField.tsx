import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, id, ...rest }: TextFieldProps) {
  const fieldId = id ?? `field-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <input id={fieldId} {...rest} />
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextAreaField({ label, error, hint, id, ...rest }: TextAreaFieldProps) {
  const fieldId = id ?? `field-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <textarea id={fieldId} {...rest} />
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}
