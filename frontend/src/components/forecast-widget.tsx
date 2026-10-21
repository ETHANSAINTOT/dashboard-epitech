import { useState } from "react";
import {
  forecastCaptionStyle,
  forecastDayStyle,
  forecastIconStyle,
  forecastListStyle,
  forecastRainStyle,
  forecastTempStyle,
  frameActionButtonStyle,
  weatherBodyStyle,
  weatherFooterStyle,
  weatherLinkStyle,
  widgetMessageStyle,
} from "../styles";
import { useWidgetData } from "../use-widget-data";
import { weatherIcon } from "../weather-icon";
import SettingsPanel, { type SettingsField } from "./settings-panel";
import { WEATHER_FIELDS } from "./weather-widget";
import WidgetFrame, { type WidgetComponentProps } from "./widget-frame";

// what GET /widgets/{id}/data answers for city_forecast (backend/catalog/weather.py)
type Day = { date: string; min: number; max: number; rain: number | null; icon: string; label: string };
type Forecast = { city: string; country: string; days: Day[]; units: { temperature: string } };

const plural = (count: number) => (count === 1 ? "1 day" : `${count} days`);

// city + units like the weather card, then the length. a select: the back accepts exactly 1 to 7 (DAYS).
// also the add window's fields (widget-types.ts)
export const FORECAST_FIELDS: SettingsField[] = [
  ...WEATHER_FIELDS,
  { key: "days", label: "Days", options: ["1", "2", "3", "4", "5", "6", "7"].map((day) => ({ value: day, label: plural(Number(day)) })) },
];

// "2026-10-07" is the city's own day: read and shown as UTC, else a browser west of Greenwich shows the day before
const formatDay = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });

export default function ForecastWidget({ instance, onRemove, onDuplicate, onUpdate, dragHandle }: WidgetComponentProps) {
  const { status, message, data, updatedAt, isRefreshing, refresh } = useWidgetData<Forecast>(instance);
  const [isEditing, setIsEditing] = useState(false);
  const city = String(instance.config.city ?? "");

  return (
    <WidgetFrame
      // the found place when ready, else the city typed: never the previous city's name next to an error
      title={status === "ready" && data ? `${data.city}, ${data.country}` : city || "Forecast"}
      onRemove={onRemove}
      onDuplicate={onDuplicate}
      dragHandle={dragHandle}
      // always there, errors included: an unknown city must stay fixable
      actions={
        <>
          <button type="button" style={frameActionButtonStyle} aria-expanded={isEditing} onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? "Close" : "Settings"}
          </button>
          <button type="button" style={frameActionButtonStyle} onClick={() => void refresh()} disabled={status === "loading" || isRefreshing}>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </>
      }
    >
      {isEditing && <SettingsPanel instance={instance} fields={FORECAST_FIELDS} onUpdate={onUpdate} onClose={() => setIsEditing(false)} />}
      {status === "loading" && <div style={widgetMessageStyle}>Loading...</div>}
      {status === "error" && <div style={widgetMessageStyle}>{message}</div>}
      {status === "ready" && data && (
        <div style={weatherBodyStyle}>
          {/* in the body, not the title: the title is cut at 3 buttons, and this tells it apart from a weather card */}
          <p style={forecastCaptionStyle}>Forecast · {plural(data.days.length)}</p>
          <ul style={forecastListStyle}>
            {data.days.map((day) => (
              <li key={day.date} style={forecastDayStyle}>
                <span>{formatDay(day.date)}</span>
                {/* the icon carries the sky: its alt says it ("Rain") */}
                <img src={weatherIcon(day.icon)} alt={day.label} title={day.label} style={forecastIconStyle} />
                <span style={forecastTempStyle}>
                  {Math.round(day.min)} – {Math.round(day.max)} {data.units.temperature}
                </span>
                {/* chance of rain (snow included). a far day can come without one: nothing rather than "null %" */}
                <span style={forecastRainStyle}>{day.rain !== null && `Rain ${day.rain} %`}</span>
              </li>
            ))}
          </ul>
          {/* the attribution is required by Open-Meteo's licence (CC BY 4.0) */}
          <p style={weatherFooterStyle}>
            Updated {updatedAt} ·{" "}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" style={weatherLinkStyle}>
              Weather data by Open-Meteo.com
            </a>
          </p>
        </div>
      )}
    </WidgetFrame>
  );
}
