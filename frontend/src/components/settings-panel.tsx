import { api, type WidgetInstance } from "../api";
import WidgetForm, { type SettingsField } from "./widget-form";

export type { SettingsField };
type SettingsPanelProps = { instance: WidgetInstance; fields: SettingsField[]; onUpdate: (updated: WidgetInstance) => void; onClose: () => void };

// the Settings panel of a card: the shared form, saved with ONE PATCH
export default function SettingsPanel({ instance, fields, onUpdate, onClose }: SettingsPanelProps) {
  const save = async (values: Record<string, string>, refreshSeconds: number) => {
    // the whole config is sent: the back replaces it, a param left out (rss "number"...) would fall back to its default
    const config = { ...instance.config, ...values };
    onUpdate(await api<WidgetInstance>(`/widgets/${instance.id}`, { method: "PATCH", auth: true, body: { config, refreshSeconds } }));
    onClose();
  };

  return (
    <WidgetForm
      variant="panel"
      idSuffix={String(instance.id)}
      fields={fields}
      start={instance}
      submitLabel="Save"
      onSubmit={save}
      onCancel={onClose}
    />
  );
}
