import { useLayoutEffect, useRef, useState } from "react";
import type { WidgetInstance } from "../api";

// same as the width of .widget-slot in index.css: keeps a card inside the canvas
export const CARD_WIDTH = 400;
// a widget still loading is shorter than it will be: when looking for a free spot, a card counts as at least this tall
export const RESERVED_HEIGHT = 240;
// card zoom (resize corner): 1 = the size it appears with, the minimum. 2 = twice as big, the maximum
export const MAX_SCALE = 2;
// free room under the lowest card, so there is always somewhere lower to drop
const CANVAS_EXTRA = 200;
const GAP = 20;

export type Place = { x: number; y: number };
export type Rect = Place & { w: number; h: number };
// a move in progress, by mouse/finger (its pointerId) or by keyboard (pointerId -1). The widget list is only written when it ends
export type Drag = Place & { id: number; pointerId: number; startX: number; startY: number; originX: number; originY: number };
// a resize in progress, same idea: by mouse/finger (its pointerId) or by keyboard (-1), written when it ends
export type Resize = { id: number; pointerId: number; startX: number; startScale: number; scale: number };
export type Layout = ReturnType<typeof useLayout>;

// Where each card is drawn and how big: its saved spot and zoom, or the live ones while it is moved or resized
// (drag and resize, written by use-move.ts and use-resize.ts). widgets: in stacking order
export function useLayout(widgets: WidgetInstance[]) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [resize, setResize] = useState<Resize | null>(null);
  // measured from the DOM: canvas width (to keep cards inside) and each card height (to size the canvas)
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [heights, setHeights] = useState<Record<number, number>>({});
  const canvasRef = useRef<HTMLDivElement>(null);
  const idsKey = widgets.map((w) => w.id).join(",");

  // layout effect = measured before paint, otherwise the first frame is drawn with unknown sizes
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const measure = () => {
      setCanvasWidth(canvas.clientWidth);
      const next: Record<number, number> = {};
      for (const child of Array.from(canvas.children) as HTMLElement[]) {
        next[Number(child.dataset.id)] = child.offsetHeight;
      }
      setHeights(next);
    };
    measure();
    // cards change height on their own (emails loaded, clock settings opened), the canvas width with the window
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    for (const child of Array.from(canvas.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [idsKey]);

  // a card's zoom: the live one while it is being resized, else the saved one. its width follows
  const scaleOf = (w: WidgetInstance) => (resize?.id === w.id ? resize.scale : (w.scale ?? 1));
  const widths = new Map(widgets.map((w) => [w.id, CARD_WIDTH * scaleOf(w)]));
  const widthOf = (id: number) => widths.get(id) ?? CARD_WIDTH;
  // furthest left a card this wide can go. Infinity until measured, so nothing gets squeezed to the left on the first frame
  const maxXFor = (width: number) => (canvasWidth > 0 ? Math.max(0, canvasWidth - width) : Infinity);

  // first free spot, rows top to bottom, each row left to right. Candidates = the canvas edge or just right of / under a card
  // width: of the card to place, CARD_WIDTH for a new one, more for a zoomed duplicate. the others have their own (r.w).
  // a zoomed card is taller too: its reserved height grows with its zoom
  const findFreeSpot = (taken: Rect[], width = CARD_WIDTH): Place => {
    const reserved = (RESERVED_HEIGHT * width) / CARD_WIDTH;
    const xs = [0, ...taken.map((r) => r.x + r.w + GAP)].filter((x) => x <= maxXFor(width)).sort((a, b) => a - b);
    const ys = [0, ...taken.map((r) => r.y + r.h + GAP)].sort((a, b) => a - b);
    for (const y of ys) {
      for (const x of xs) {
        const free = taken.every((r) => x + width + GAP <= r.x || r.x + r.w + GAP <= x || y + reserved + GAP <= r.y || r.y + r.h + GAP <= y);
        if (free) return { x, y };
      }
    }
    // never reached: under the lowest card is always free
    return { x: 0, y: 0 };
  };

  // saved spot, pulled back inside if the screen got narrower. Widgets never placed (created before free placement)
  // get a free spot each time, until they are moved once
  const places = new Map<number, Place>();
  const takenRects = () =>
    [...places].map(([id, p]) => ({ ...p, w: widthOf(id), h: Math.max(heights[id] ?? 0, (RESERVED_HEIGHT * widthOf(id)) / CARD_WIDTH) }));
  for (const widget of widgets) {
    if (widget.x !== null && widget.y !== null) places.set(widget.id, { x: Math.min(widget.x, maxXFor(widthOf(widget.id))), y: widget.y });
  }
  for (const widget of widgets) {
    if (widget.x === null || widget.y === null) places.set(widget.id, findFreeSpot(takenRects(), widthOf(widget.id)));
  }
  const placeOf = (id: number): Place => (drag?.id === id ? drag : places.get(id) ?? { x: 0, y: 0 });
  const contentBottom = Math.max(0, ...widgets.map((w) => placeOf(w.id).y + (heights[w.id] ?? 0)));
  // DOM (and Tab) order = top to bottom, left to right. From the SAVED spots: following the live drag would move
  // the dragged node in the DOM, and a detached node loses its pointer capture
  const readingOrder = [...widgets].sort((a, b) => {
    const pa = places.get(a.id) ?? { x: 0, y: 0 };
    const pb = places.get(b.id) ?? { x: 0, y: 0 };
    return pa.y - pb.y || pa.x - pb.x;
  });

  // biggest zoom for this card: 2, or less when its right edge would leave the canvas. never under 1
  const maxScaleOf = (id: number) =>
    canvasWidth > 0 ? Math.max(1, Math.min(MAX_SCALE, Math.floor(((canvasWidth - placeOf(id).x) / CARD_WIDTH) * 100) / 100)) : MAX_SCALE;

  return {
    canvasRef, canvasHeight: contentBottom + CANVAS_EXTRA, readingOrder, placeOf, scaleOf, widthOf, maxXFor, maxScaleOf,
    // a spot for a new card, away from the cards AND from the spots promised to adds still waiting for the server
    freeSpot: (width: number, pending: Rect[]) => findFreeSpot([...takenRects(), ...pending], width),
    drag, setDrag, resize, setResize,
  };
}
