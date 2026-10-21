import { useEffect, useState } from "react";
import { clockBadgeStyle, clockBadgesStyle, clockBodyStyle, clockDateStyle, clockTimeStyle, frameActionButtonStyle, widgetMessageStyle } from "../styles";
import { useWidgetData } from "../use-widget-data";
import SettingsPanel, { type SettingsField } from "./settings-panel";
import WidgetFrame, { type WidgetComponentProps } from "./widget-frame";

// what GET /widgets/{id}/data answers for current_time (backend/catalog/clock.py)
type Clock = { city: string; country: string; timezone: string; offset: string; abbreviation: string; dst: boolean; now: number };

// any city: the back finds it and its time zone, like the weather card. also the add window's fields (widget-types.ts)
export const CLOCK_FIELDS: SettingsField[] = [{ key: "city", label: "City", maxLength: 100 }];

// the card's second hand, on the server's time (browser clock + skew). each tick waits for the next full
// second OF THAT TIME: a setInterval(1000) drifts, so a second shows up late and sometimes one is skipped.
// +10 ms: land just after the second starts, never a hair before (that would show the previous one)
function useServerNow(skew: number) {
  const [now, setNow] = useState(() => Date.now() + skew);
  useEffect(() => {
    let timer: number | undefined;
    const tick = () => {
      const current = Date.now() + skew;
      setNow(current);
      timer = window.setTimeout(tick, 1000 - (current % 1000) + 10);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [skew]);
  return now;
}

export default function ClockWidget({ instance, onRemove, onDuplicate, onUpdate, dragHandle }: WidgetComponentProps) {
  const { status, message, data } = useWidgetData<Clock>(instance);
  const [isEditing, setIsEditing] = useState(false);
  // server clock minus browser clock, measured at each read: a computer set a few minutes off still shows the right time
  const [skew, setSkew] = useState(0);
  useEffect(() => {
    if (data) setSkew(data.now - Date.now());
  }, [data]);
  const now = new Date(useServerNow(skew));
  const city = String(instance.config.city ?? "");

  return (
    <WidgetFrame
      // the found place when ready, else the city typed: never the previous city's name next to an error
      title={status === "ready" && data ? `${data.city}, ${data.country}` : city || "Clock"}
      onRemove={onRemove}
      onDuplicate={onDuplicate}
      dragHandle={dragHandle}
      // no Refresh: the seconds already tick live, the timer only re-syncs. Settings stays, errors included
      actions={
        <button type="button" style={frameActionButtonStyle} aria-expanded={isEditing} onClick={() => setIsEditing(!isEditing)}>
          {isEditing ? "Close" : "Settings"}
        </button>
      }
    >
      {isEditing && <SettingsPanel instance={instance} fields={CLOCK_FIELDS} onUpdate={onUpdate} onClose={() => setIsEditing(false)} />}
      {status === "loading" && <div style={widgetMessageStyle}>Loading...</div>}
      {status === "error" && <div style={widgetMessageStyle}>{message}</div>}
      {status === "ready" && data && (
        <div style={clockBodyStyle}>
          {/* timeZone: the browser converts to the city's time, summer time included */}
          <p style={clockTimeStyle}>{now.toLocaleTimeString("en-GB", { timeZone: data.timezone })}</p>
          <p style={clockDateStyle}>
            {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: data.timezone })}
          </p>
          <ul style={clockBadgesStyle}>
            <li style={clockBadgeStyle}>{data.timezone}</li>
            <li style={clockBadgeStyle}>
              UTC {data.offset} · {data.abbreviation}
            </li>
            <li style={clockBadgeStyle}>{data.dst ? "Summer time" : "Standard time"}</li>
          </ul>
        </div>
      )}
    </WidgetFrame>
  );
}
