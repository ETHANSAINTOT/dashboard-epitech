import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, clearToken, getToken, type WidgetInstance } from "../api";
import AddWidgetModal from "../dashboard/add-widget-modal";
import DashboardHeader from "../dashboard/dashboard-header";
import DeleteAccountModal from "../dashboard/delete-account-modal";
import { useLayout } from "../dashboard/use-layout";
import { useMove } from "../dashboard/use-move";
import { useResize } from "../dashboard/use-resize";
import { useWidgetActions } from "../dashboard/use-widget-actions";
import WidgetCanvas from "../dashboard/widget-canvas";
import WidgetLibrary from "../dashboard/widget-library";
import { dashboardPageStyle } from "../styles";
import { findWidgetType, type WidgetType } from "../widget-types";

type Me = { clientId: string; firstName: string; lastName: string; email: string };

// The dashboard page: loads the user and their widgets, then puts together the pieces of src/dashboard/
export default function Dashboard() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  // order of the list = stacking order (last = drawn on top), like position in the back
  const [widgets, setWidgets] = useState<WidgetInstance[]>([]);
  // the type whose add window is open, null = closed
  const [addingType, setAddingType] = useState<WidgetType | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  // read by screen readers only (sr-only paragraph in the sidebar)
  const [announcement, setAnnouncement] = useState("");
  // focus target once a removed widget takes its focused × button away
  const titleRef = useRef<HTMLHeadingElement>(null);

  // only the widget types the front can render (see widget-types.ts)
  const visibleWidgets = widgets.filter((w) => Boolean(findWidgetType(w)));
  const layout = useLayout(visibleWidgets);
  const actions = useWidgetActions(widgets, setWidgets, { layout, announce: setAnnouncement, titleRef });
  const moveHandle = useMove(layout, actions.moveTo);
  const resizeHandle = useResize(layout, actions.resizeTo);

  const loadWidgets = async () => {
    try {
      const list = await api<WidgetInstance[]>("/widgets", { auth: true });
      if (Array.isArray(list)) setWidgets(list);
    } catch {
      // If backend widget list cannot be loaded yet
    }
  };

  useEffect(() => {
    if (!getToken()) { navigate("/signin"); return; }

    api<Me>("/me", { auth: true })
      .then((user) => { setMe(user); return loadWidgets(); })
      .catch(() => { clearToken(); navigate("/signin"); });
  }, [navigate]);

  // "+ Add": a type with fields opens its add window, the others (gmail) are added straight away
  const handleAdd = async (type: WidgetType) => {
    if (type.fields) setAddingType(type);
    else await actions.create(type, type.defaultConfig, type.defaultRefreshSeconds ?? 60);
  };

  if (me === null) {
    return (
      <main className="dashboard-page" style={dashboardPageStyle}>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-page" style={dashboardPageStyle}>
      <DashboardHeader firstName={me.firstName} />
      <div className="dashboard-body">
        <WidgetLibrary onAdd={handleAdd} announcement={announcement} onDeleteAccount={() => setIsDeleteOpen(true)} />
        <WidgetCanvas widgets={visibleWidgets} layout={layout} actions={actions} moveHandle={moveHandle} resizeHandle={resizeHandle} titleRef={titleRef} />
      </div>

      {addingType && (
        <AddWidgetModal type={addingType} onAdd={(config, refreshSeconds) => actions.create(addingType, config, refreshSeconds)} onClose={() => setAddingType(null)} />
      )}
      {isDeleteOpen && <DeleteAccountModal onClose={() => setIsDeleteOpen(false)} />}
    </main>
  );
}
