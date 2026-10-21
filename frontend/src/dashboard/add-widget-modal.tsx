import Modal from "../components/modal";
import WidgetForm from "../components/widget-form";
import type { WidgetType } from "../widget-types";

type Props = {
  type: WidgetType;
  // throws when the server refuses: the window stays open and shows the error
  onAdd: (config: Record<string, unknown>, refreshSeconds: number) => Promise<void>;
  onClose: () => void;
};

// "+ Add" of a type with fields: they are filled here first (+ the refresh), the widget is only created on "Add widget"
export default function AddWidgetModal({ type, onAdd, onClose }: Props) {
  const start = { config: type.defaultConfig, refreshSeconds: type.defaultRefreshSeconds ?? 60 };

  return (
    <Modal title={`Add a ${type.label} widget`} onClose={onClose}>
      <WidgetForm variant="dialog" idSuffix="new" fields={type.fields ?? []} start={start} defaults={start} submitLabel="Add widget"
        withRefresh={!type.hideRefresh} onCancel={onClose}
        onSubmit={async (values, refreshSeconds) => {
          // the default config under the typed values: a param with no field (rss "number"...) keeps its default
          await onAdd({ ...type.defaultConfig, ...values }, refreshSeconds);
          onClose();
        }}
      />
    </Modal>
  );
}
