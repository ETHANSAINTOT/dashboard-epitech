import { useState } from "react";
import { deleteAccountButtonStyle, errorStyle, sidebarItemDescStyle, sidebarItemLabelStyle, sidebarItemStyle, sidebarTitleStyle, widgetButtonStyle } from "../styles";
import { WIDGET_TYPES, type WidgetType } from "../widget-types";

type Props = {
  // throws when the widget could not be added: the error is shown under the list
  onAdd: (type: WidgetType) => Promise<void>;
  // read by screen readers only: "Clock added", "Clock moved"...
  announcement: string;
  onDeleteAccount: () => void;
};

// the sidebar: every widget type with its "+ Add" button, and the account deletion at the bottom
export default function WidgetLibrary({ onAdd, announcement, onDeleteAccount }: Props) {
  const [error, setError] = useState<string | null>(null);

  const add = async (type: WidgetType) => {
    setError(null);
    try {
      await onAdd(type);
    } catch (caught) {
      setError(`Could not add the ${type.label} widget: ${(caught as Error).message}`);
    }
  };

  return (
    <aside className="dashboard-sidebar" aria-label="Widget library">
      <h2 style={sidebarTitleStyle}>Widgets</h2>
      <div className="sidebar-list">
        {WIDGET_TYPES.map((type) => (
          <div key={type.id} className="sidebar-item" style={sidebarItemStyle}>
            <div>
              <p style={sidebarItemLabelStyle}>{type.label}</p>
              <p style={sidebarItemDescStyle}>{type.description}</p>
            </div>
            <button type="button" aria-label={`Add a ${type.label} widget`} onClick={() => void add(type)} style={widgetButtonStyle}>+ Add</button>
          </div>
        ))}
        {/* a whole row of the 2-column grid on a phone */}
        {error && <p role="alert" style={{ ...errorStyle, gridColumn: "1 / -1" }}>{error}</p>}
      </div>

      <p className="sr-only" aria-live="polite">{announcement}</p>

      <div className="sidebar-footer">
        <button type="button" onClick={onDeleteAccount} style={deleteAccountButtonStyle}>Delete my account</button>
      </div>
    </aside>
  );
}
