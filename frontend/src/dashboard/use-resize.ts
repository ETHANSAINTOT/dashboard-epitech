import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import type { WidgetInstance } from "../api";
import { CARD_WIDTH, MAX_SCALE, type Layout, type Resize } from "./use-layout";

// resize corner on the keyboard: 10 % per press
const SCALE_KEYS: Record<string, number> = { ArrowRight: 0.1, ArrowUp: 0.1, ArrowLeft: -0.1, ArrowDown: -0.1 };

export type ResizeHandle = ReturnType<typeof useResize>;

// Zooming a card by its resize corner: mouse, finger, or keyboard (arrows, Home, End).
// onResized gets the new zoom once, when the resize ends. Returns the event props of a card's corner
export function useResize({ resize, setResize, scaleOf, maxScaleOf }: Layout, onResized: (id: number, scale: number) => void) {
  const keyTimer = useRef<number | undefined>(undefined);

  // kept between 1 (the size it appeared with) and its max, rounded to the percent
  const clamp = (id: number, scale: number) => Math.min(Math.max(1, Math.round(scale * 100) / 100), maxScaleOf(id));

  // end of a resize: given to onResized, unless the size did not change (a plain click)
  const commit = (done: Resize) => {
    setResize((prev) => (prev?.id === done.id ? null : prev));
    if (done.scale !== done.startScale) onResized(done.id, done.scale);
  };

  // new zoom = start zoom + how far the pointer went right, in card widths: the corner stays under the pointer
  const follow = (r: Resize, e: PointerEvent): Resize => ({ ...r, scale: clamp(r.id, r.startScale + (e.clientX - r.startX) / CARD_WIDTH) });

  return (widget: WidgetInstance) => ({
    onPointerDown: (e: PointerEvent<HTMLSpanElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      // a keyboard resize still waiting for its save is saved now, before this one starts
      window.clearTimeout(keyTimer.current);
      if (resize && resize.pointerId === -1) commit(resize);
      e.currentTarget.setPointerCapture(e.pointerId);
      const start = scaleOf(widget);
      setResize({ id: widget.id, pointerId: e.pointerId, startX: e.clientX, startScale: start, scale: start });
    },
    onPointerMove: (e: PointerEvent<HTMLSpanElement>) => setResize((prev) => (prev && prev.pointerId === e.pointerId ? follow(prev, e) : prev)),
    onPointerUp: (e: PointerEvent<HTMLSpanElement>) => {
      if (resize && resize.pointerId === e.pointerId) commit(follow(resize, e));
    },
    onPointerCancel: () => setResize(null),
    // arrows: 10 % per press. Home: back to the size it appeared with. End: as big as it can be
    onKeyDown: (e: KeyboardEvent<HTMLSpanElement>) => {
      const step = SCALE_KEYS[e.key];
      if (step === undefined && e.key !== "Home" && e.key !== "End") return;
      e.preventDefault();
      const start = scaleOf(widget);
      const base: Resize =
        resize?.id === widget.id && resize.pointerId === -1 ? resize : { id: widget.id, pointerId: -1, startX: 0, startScale: start, scale: start };
      const target = e.key === "Home" ? 1 : e.key === "End" ? MAX_SCALE : base.scale + step;
      const next = { ...base, scale: clamp(widget.id, target) };
      setResize(next);
      // one request once the keys stop, not one per press
      window.clearTimeout(keyTimer.current);
      keyTimer.current = window.setTimeout(() => commit(next), 400);
    },
  });
}
