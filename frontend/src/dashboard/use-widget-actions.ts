import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { api, ApiError, type WidgetInstance } from "../api";
import { findWidgetType, type WidgetType } from "../widget-types";
import { CARD_WIDTH, RESERVED_HEIGHT, type Layout, type Rect } from "./use-layout";

type Options = {
  layout: Layout;
  // for screen readers: "Clock added", "Clock moved"...
  announce: (message: string) => void;
  // focus target once a removed widget takes its focused × button away
  titleRef: RefObject<HTMLHeadingElement>;
};

export type WidgetActions = ReturnType<typeof useWidgetActions>;

// Everything that changes the widget list: add, duplicate, remove, update, move, resize. A change shows at once
// and is undone if the server refuses it. widgets: in stacking order (last = drawn on top), like position in the back
export function useWidgetActions(widgets: WidgetInstance[], setWidgets: Dispatch<SetStateAction<WidgetInstance[]>>, { layout, announce, titleRef }: Options) {
  // cards fading out before removal, so you see WHICH one goes
  const [leavingIds, setLeavingIds] = useState<number[]>([]);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  // spots promised to adds still waiting for the server, so quick clicks do not get the same one
  const pendingSpots = useRef<Rect[]>([]);
  const scrollToId = useRef<number | null>(null);

  const labelOf = (id: number) => {
    const widget = widgets.find((w) => w.id === id);
    return (widget && findWidgetType(widget)?.label) ?? "Widget";
  };

  // a new card can land below the fold
  useEffect(() => {
    if (scrollToId.current === null) return;
    document.querySelector(`.widget-slot[data-id="${scrollToId.current}"]`)?.scrollIntoView({ block: "nearest" });
    scrollToId.current = null;
  }, [widgets]);

  // POST at a free spot. throws: the caller shows the error where the user is looking (sidebar or add window)
  const create = async (type: WidgetType, config: Record<string, unknown>, refreshSeconds: number, scale = 1) => {
    const width = CARD_WIDTH * scale;
    const spot = { ...layout.freeSpot(width, pendingSpots.current), w: width, h: RESERVED_HEIGHT * scale };
    pendingSpots.current.push(spot);
    try {
      const created = await api<WidgetInstance>("/widgets", {
        method: "POST",
        auth: true,
        body: { serviceName: type.serviceName, widgetName: type.widgetName, config, refreshSeconds, scale, x: spot.x, y: spot.y },
      });
      scrollToId.current = created.id;
      // functional update: quick repeated clicks each append to the latest list, none gets lost
      setWidgets((prev) => [...prev, created]);
      announce(`${type.label} added`);
    } finally {
      pendingSpots.current = pendingSpots.current.filter((r) => r !== spot);
    }
  };

  // same type, same settings (config, refresh, zoom), at the first free spot. no window: nothing to ask.
  // a gmail copy is not connected: the Google account is not a setting, the copy connects on its own
  const duplicate = async (widget: WidgetInstance) => {
    const type = findWidgetType(widget);
    if (!type) return;
    setLayoutError(null);
    try {
      await create(type, widget.config, widget.refreshSeconds, widget.scale ?? 1);
      announce(`${type.label} duplicated`);
    } catch (caught) {
      setLayoutError(`Could not duplicate the ${type.label} widget: ${(caught as Error).message}`);
    }
  };

  const remove = async (id: number) => {
    // double click on × during the fade
    if (leavingIds.includes(id)) return;
    setRemoveError(null);
    const index = widgets.findIndex((w) => w.id === id);
    const removed = widgets[index];
    if (!removed) return;
    const label = labelOf(id);

    // fade BEFORE the request, not alongside: a failure during the fade would be undone by the filter below
    setLeavingIds((prev) => [...prev, id]);
    await new Promise((resolve) => setTimeout(resolve, 200));
    setLeavingIds((prev) => prev.filter((x) => x !== id));

    // optimistic: the widget leaves the screen now, put back below if the server refuses
    setWidgets((prev) => prev.filter((w) => w.id !== id));
    // preventScroll: a mouse user deleting at the bottom of the page must not be thrown back to the top
    titleRef.current?.focus({ preventScroll: true });

    try {
      await api(`/widgets/${id}`, { method: "DELETE", auth: true });
      announce(`${label} removed`);
    } catch (caught) {
      // 404 = already deleted elsewhere (another tab): the goal is reached, not an error
      if (caught instanceof ApiError && caught.status === 404) return announce(`${label} removed`);
      // put back only this widget at its old place; restoring a whole snapshot would undo other removals
      setWidgets((prev) => {
        if (prev.some((w) => w.id === id)) return prev;
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, removed);
        return next;
      });
      setRemoveError(`Could not remove the ${label} widget: ${(caught as Error).message}`);
    }
  };

  // the server's version replaces ours, in place: the list order (= stacking order) does not move
  const update = (updated: WidgetInstance) => setWidgets((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));

  // a new spot or zoom. optimistic, and moved to the end of the list = drawn on top, the back does the same with position
  const save = async (id: number, changes: Partial<WidgetInstance>, what: string) => {
    const before = widgets.find((w) => w.id === id);
    if (!before) return;
    setLayoutError(null);
    setWidgets((prev) => {
      const saved = prev.find((w) => w.id === id);
      return saved ? [...prev.filter((w) => w.id !== id), { ...saved, ...changes }] : prev;
    });

    try {
      await api(`/widgets/${id}`, { method: "PATCH", auth: true, body: changes });
    } catch (caught) {
      // deleted meanwhile: nothing left to save
      if (caught instanceof ApiError && caught.status === 404) return;
      setLayoutError(`Could not save the new ${what}: ${(caught as Error).message}`);
      // only what changed goes back; the card stays on top, that part is harmless
      const undo: Partial<WidgetInstance> = Object.fromEntries(Object.keys(changes).map((key) => [key, before[key as keyof WidgetInstance]]));
      setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, ...undo } : w)));
    }
  };

  const moveTo = (id: number, x: number, y: number) => {
    announce(`${labelOf(id)} moved`);
    void save(id, { x, y }, "position");
  };

  const resizeTo = (id: number, scale: number) => {
    announce(`${labelOf(id)} at ${Math.round(scale * 100)} %`);
    void save(id, { scale }, "size");
  };

  return { leavingIds, removeError, layoutError, create, duplicate, remove, update, moveTo, resizeTo };
}
