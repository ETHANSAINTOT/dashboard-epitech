import type { ReactNode } from "react";
import type { WidgetInstance } from "../api";
import { frameActionsStyle, frameIconButtonStyle, frameRemoveButtonStyle, frameTitleStyle, widgetCardStyle, widgetHeaderStyle } from "../styles";

// what the dashboard hands to EVERY widget, whatever its type
export type WidgetComponentProps = {
  instance: WidgetInstance;
  onRemove: () => void;
  // a new card of the same type with the same settings, built by the dashboard
  onDuplicate: () => void;
  // the widget hands back what the server answered to its PATCH: config, refreshSeconds... all in one
  onUpdate: (updated: WidgetInstance) => void;
  // built by the dashboard (it owns the order), the widget only passes it on to its frame
  dragHandle?: ReactNode;
};

type FrameProps = {
  title: string;
  actions?: ReactNode;
  onRemove: () => void;
  onDuplicate: () => void;
  dragHandle?: ReactNode;
  children: ReactNode;
};

export default function WidgetFrame({ title, actions, onRemove, onDuplicate, dragHandle, children }: FrameProps) {
  return (
    <article style={widgetCardStyle}>
      <header className="widget-header" style={widgetHeaderStyle}>
        {/* handle + title together: a long title never leaves the handle alone on a row */}
        <div className="widget-heading">
          {dragHandle}
          <h3 className="widget-title" style={frameTitleStyle}>
            {title}
          </h3>
        </div>

        {/* the type-specific actions and the remove button sit together on the right */}
        <div className="widget-actions" style={frameActionsStyle}>
          {actions}
          {/* an svg and not a character: a "⧉" is missing from some fonts and shows as an empty box */}
          <button type="button" aria-label={`Duplicate ${title}`} title={`Duplicate ${title}`} style={frameIconButtonStyle} onClick={onDuplicate}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <rect x="4.5" y="4.5" width="8" height="8" rx="1.5" />
              <path d="M9.5 2.5V2a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v6.5a1 1 0 0 0 1 1h.5" />
            </svg>
          </button>
          <button
            type="button"
            aria-label={`Remove ${title}`}
            title={`Remove ${title}`}
            style={frameRemoveButtonStyle}
            onClick={onRemove}
          >
            ×
          </button>
        </div>
      </header>

      {children}
    </article>
  );
}
