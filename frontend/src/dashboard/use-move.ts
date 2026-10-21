import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import type { Drag, Layout } from "./use-layout";

const KEY_STEPS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

export type MoveHandle = ReturnType<typeof useMove>;

// Moving a card by its handle (⠿): mouse, finger, or arrow keys (Shift for bigger steps).
// onMoved gets the new spot once, when the move ends. Returns the event props of a card's handle
export function useMove({ drag, setDrag, placeOf, widthOf, maxXFor }: Layout, onMoved: (id: number, x: number, y: number) => void) {
  const keyTimer = useRef<number | undefined>(undefined);

  // end of a move: given to onMoved, unless the card did not actually move (a plain click)
  const commit = (done: Drag) => {
    setDrag((prev) => (prev?.id === done.id ? null : prev));
    if (done.x !== done.originX || done.y !== done.originY) onMoved(done.id, done.x, done.y);
  };

  // new spot = where the card started + how far the pointer went, kept inside the canvas (left, right, top)
  const follow = (d: Drag, e: PointerEvent): Drag => ({
    ...d,
    x: Math.round(Math.min(Math.max(0, d.originX + e.clientX - d.startX), maxXFor(widthOf(d.id)))),
    y: Math.round(Math.max(0, d.originY + e.clientY - d.startY)),
  });

  return (id: number) => ({
    onPointerDown: (e: PointerEvent<HTMLSpanElement>) => {
      // left button only (touch and pen report 0 too)
      if (e.button !== 0) return;
      // no text selected while dragging
      e.preventDefault();
      // a keyboard move still waiting for its save is saved now, before this one starts
      window.clearTimeout(keyTimer.current);
      if (drag && drag.pointerId === -1) commit(drag);
      // the following moves come to the handle even when the pointer runs ahead of the card
      e.currentTarget.setPointerCapture(e.pointerId);
      const start = placeOf(id);
      setDrag({ id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, originX: start.x, originY: start.y, x: start.x, y: start.y });
    },
    // the handle also gets plain hovers: only the pointer that started the drag counts
    onPointerMove: (e: PointerEvent<HTMLSpanElement>) => setDrag((prev) => (prev && prev.pointerId === e.pointerId ? follow(prev, e) : prev)),
    // computed from this event: the last move may not be rendered yet
    onPointerUp: (e: PointerEvent<HTMLSpanElement>) => {
      if (drag && drag.pointerId === e.pointerId) commit(follow(drag, e));
    },
    // the browser took the gesture over (scroll, notification…): the card goes back to its start
    onPointerCancel: () => setDrag(null),
    onKeyDown: (e: KeyboardEvent<HTMLSpanElement>) => {
      const step = KEY_STEPS[e.key];
      if (!step) return;
      // arrows would also scroll the page
      e.preventDefault();
      const size = e.shiftKey ? 50 : 10;
      const start = placeOf(id);
      const base: Drag =
        drag?.id === id && drag.pointerId === -1 ? drag : { id, pointerId: -1, startX: 0, startY: 0, originX: start.x, originY: start.y, x: start.x, y: start.y };
      const next = { ...base, x: Math.min(Math.max(0, base.x + step[0] * size), maxXFor(widthOf(id))), y: Math.max(0, base.y + step[1] * size) };
      setDrag(next);
      // one request once the keys stop, not one per press
      window.clearTimeout(keyTimer.current);
      keyTimer.current = window.setTimeout(() => commit(next), 400);
    },
  });
}
