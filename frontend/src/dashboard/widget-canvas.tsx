import type { CSSProperties, RefObject } from "react";
import type { WidgetInstance } from "../api";
import { canvasTitleStyle, emptyCanvasStyle, emptyCanvasTextStyle, errorStyle } from "../styles";
import { findWidgetType } from "../widget-types";
import type { Layout } from "./use-layout";
import type { MoveHandle } from "./use-move";
import type { ResizeHandle } from "./use-resize";
import type { WidgetActions } from "./use-widget-actions";

type Props = {
  // the widgets shown, in stacking order (last = drawn on top)
  widgets: WidgetInstance[];
  layout: Layout;
  actions: WidgetActions;
  moveHandle: MoveHandle;
  resizeHandle: ResizeHandle;
  titleRef: RefObject<HTMLHeadingElement>;
};

// "My widgets": every card at its spot, with its move handle (⠿) and its resize corner
export default function WidgetCanvas({ widgets, layout, actions, moveHandle, resizeHandle, titleRef }: Props) {
  return (
    <section className="dashboard-canvas" aria-label="My widgets">
      <h2 ref={titleRef} tabIndex={-1} style={canvasTitleStyle}>Active Widgets</h2>
      {actions.removeError && <p role="alert" style={errorStyle}>{actions.removeError}</p>}
      {actions.layoutError && <p role="alert" style={errorStyle}>{actions.layoutError}</p>}

      {widgets.length === 0 ? (
        <div style={emptyCanvasStyle}>
          <p style={emptyCanvasTextStyle}>No widgets yet. Add one from the sidebar.</p>
        </div>
      ) : (
        // CSS variables, not left/top: the phone layout in index.css can then ignore them and stack the cards
        <div ref={layout.canvasRef} className="widget-canvas" style={{ "--canvas-height": `${layout.canvasHeight}px` } as CSSProperties}>
          {layout.readingOrder.map((widget) => {
            const type = findWidgetType(widget);
            if (!type) return null;
            const place = layout.placeOf(widget.id);
            const scale = layout.scaleOf(widget);
            const percent = Math.round(scale * 100);
            const classes = [
              "widget-slot",
              layout.drag?.id === widget.id && "is-dragging",
              layout.resize?.id === widget.id && "is-resizing",
              actions.leavingIds.includes(widget.id) && "is-leaving",
            ].filter(Boolean).join(" ");

            const dragHandle = (
              <span id={`handle-${widget.id}`} className="drag-handle" tabIndex={0} role="button" title="Drag to move"
                aria-label={`Move ${type.label}. Drag it, or use the arrow keys (Shift for bigger steps)`} {...moveHandle(widget.id)}>⠿</span>
            );
            const Component = type.Component;
            return (
              // key on the outermost element, else React matches cards by position and their state jumps to a neighbour
              <div key={widget.id} data-id={widget.id} className={classes}
                style={{ "--x": `${place.x}px`, "--y": `${place.y}px`, "--z": widgets.indexOf(widget) + 1, "--scale": scale } as CSSProperties}>
                <Component instance={widget} onRemove={() => void actions.remove(widget.id)} onDuplicate={() => void actions.duplicate(widget)}
                  onUpdate={actions.update} dragHandle={dragHandle} />
                {/* a slider for screen readers and the keyboard: arrows, Home, End */}
                <span className="resize-handle" role="slider" tabIndex={0} title="Drag to resize" aria-orientation="horizontal"
                  aria-label={`Size of ${type.label}. Drag the corner, or use the arrow keys (Home: normal size)`}
                  aria-valuemin={100} aria-valuemax={Math.round(layout.maxScaleOf(widget.id) * 100)} aria-valuenow={percent} aria-valuetext={`${percent} %`}
                  {...resizeHandle(widget)} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
