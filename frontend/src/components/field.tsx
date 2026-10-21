import type { ChangeEvent } from "react";
import { errorStyle, fieldStyle, inputStyle, labelStyle } from "../styles";

type FieldProps = {id: string; label: string; value: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; type?: string; error?: string; maxLength?: number};

export default function Field({ id, label, value, onChange, type = "text", error, maxLength }: FieldProps) {
  return (
    <div style={fieldStyle}>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <input id={id} name={id} type={type} value={value} onChange={onChange} maxLength={maxLength} aria-invalid={Boolean(error)} style={{ ...inputStyle, borderColor: error ? "#c62828" : "#ddd" }} />
      {error && <span style={errorStyle}>{error}</span>}
    </div>
  );
}