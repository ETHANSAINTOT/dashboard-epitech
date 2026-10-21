import { useState, type FormEvent } from "react";
import { parseSeconds, REFRESH_MAX_SECONDS, REFRESH_MIN_SECONDS } from "../refresh";
import {
  errorStyle,
  fieldStyle,
  formActionsStyle,
  formButtonStyle,
  formCancelButtonStyle,
  formPrimaryButtonStyle,
  frameActionButtonStyle,
  inputStyle,
  labelStyle,
  settingsActionsStyle,
  settingsHintStyle,
  settingsPanelStyle,
} from "../styles";
import Field from "./field";

// one entry per setting: a text field, or a select when options are given
export type SettingsField = { key: string; label: string; options?: { value: string; label: string }[]; maxLength?: number };
// a config + its refresh interval: what the form starts from, and what "Default" puts back
export type FormStart = { config: Record<string, unknown>; refreshSeconds: number };

type WidgetFormProps = {
  // "panel": Settings at the top of a card. "dialog": the add window, bigger buttons
  variant: "panel" | "dialog";
  // in every field id: several forms on the page (one per card) never share an id
  idSuffix: string;
  fields: SettingsField[];
  start: FormStart;
  // given = a "Default" button that puts these values back
  defaults?: FormStart;
  submitLabel: string;
  // false: no refresh field (translate works as you type, it has no timer to set). start.refreshSeconds is sent as is
  withRefresh?: boolean;
  // the edited fields (trimmed text) + the checked interval. throws -> its message shows in the form
  onSubmit: (values: Record<string, string>, refreshSeconds: number) => Promise<void>;
  onCancel: () => void;
};

// each field as text: { city: "Paris" }. a select starts on its 1st option when the config has nothing
const toValues = (fields: SettingsField[], config: Record<string, unknown>) =>
  Object.fromEntries(fields.map((field) => [field.key, String(config[field.key] ?? field.options?.[0].value ?? "")]));

// the widget settings form: its own fields + the refresh interval, checked before anything is sent.
// used by the card's Settings panel (save) and by the add window (create)
export default function WidgetForm({ variant, idSuffix, fields, start, defaults, submitLabel, withRefresh = true, onSubmit, onCancel }: WidgetFormProps) {
  const [values, setValues] = useState(() => toValues(fields, start.config));
  const [refresh, setRefresh] = useState(String(start.refreshSeconds));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isDialog = variant === "dialog";
  const buttonStyle = isDialog ? formButtonStyle : frameActionButtonStyle;

  const change = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  const resetTo = (target: FormStart) => {
    setValues(toValues(fields, target.config));
    setRefresh(String(target.refreshSeconds));
    setError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // the back checks it all again (422): this only saves a round trip
    const empty = fields.find((field) => !values[field.key].trim());
    if (empty) return setError(`${empty.label} cannot be empty`);
    const seconds = parseSeconds(withRefresh ? refresh : String(start.refreshSeconds));
    if ("error" in seconds) return setError(seconds.error);
    setIsSaving(true);
    try {
      await onSubmit(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()])), seconds.seconds);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    // a form: Enter submits too. noValidate: our own checks, not the browser's
    <form style={isDialog ? undefined : settingsPanelStyle} onSubmit={submit} noValidate>
      {fields.map(({ key, label, options, maxLength }) =>
        options ? (
          <div key={key} style={fieldStyle}>
            <label htmlFor={`${key}-${idSuffix}`} style={labelStyle}>
              {label}
            </label>
            <select id={`${key}-${idSuffix}`} value={values[key]} onChange={(event) => change(key, event.target.value)} style={inputStyle}>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <Field key={key} id={`${key}-${idSuffix}`} label={label} value={values[key]} onChange={(event) => change(key, event.target.value)} maxLength={maxLength} />
        )
      )}
      {withRefresh && (
        <>
          <Field id={`refresh-${idSuffix}`} label="Refresh every (seconds)" value={refresh} onChange={(event) => setRefresh(event.target.value)} maxLength={9} />
          <p style={settingsHintStyle}>
            Use a dot for milliseconds: 12.5 = 12 s 500 ms. Between {REFRESH_MIN_SECONDS} and {REFRESH_MAX_SECONDS}.
          </p>
        </>
      )}
      {error && (
        <p role="alert" style={errorStyle}>
          {error}
        </p>
      )}
      <div style={isDialog ? formActionsStyle : settingsActionsStyle}>
        <button type="submit" style={isDialog ? formPrimaryButtonStyle : buttonStyle} disabled={isSaving}>
          {isSaving ? "Saving..." : submitLabel}
        </button>
        {defaults && (
          <button type="button" style={buttonStyle} onClick={() => resetTo(defaults)}>
            Default
          </button>
        )}
        <button type="button" style={isDialog ? formCancelButtonStyle : buttonStyle} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
