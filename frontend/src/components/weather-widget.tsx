import { useState } from "react";
import {
  frameActionButtonStyle,
  weatherBodyStyle,
  weatherDetailsStyle,
  weatherDetailStyle,
  weatherFooterStyle,
  weatherIconStyle,
  weatherLabelStyle,
  weatherLinkStyle,
  weatherMainStyle,
  weatherSmallIconStyle,
  weatherTempStyle,
  widgetMessageStyle,
} from "../styles";
import { useWidgetData } from "../use-widget-data";
import { humidityIcon, weatherIcon, windIcon } from "../weather-icon";
import SettingsPanel, { type SettingsField } from "./settings-panel";
import WidgetFrame, { type WidgetComponentProps } from "./widget-frame";

// what GET /widgets/{id}/data answers for city_temperature (backend/catalog/weather.py)
type Weather = {
  city: string;
  country: string;
  temperature: number;
  humidity: number;
  wind: number;
  icon: string;
  label: string;
  units: { temperature: string; wind: string };
};

// what the Settings panel shows, on top of the refresh interval. the forecast card starts from the same fields
export const WEATHER_FIELDS: SettingsField[] = [
  { key: "city", label: "City", maxLength: 100 },
  { key: "units", label: "Units", options: [{ value: "metric", label: "Metric (°C, km/h)" }, { value: "imperial", label: "Imperial (°F, mph)" }] },
];

export default function WeatherWidget({ instance, onRemove, onDuplicate, onUpdate, dragHandle }: WidgetComponentProps) {
  const { status, message, data, updatedAt, isRefreshing, refresh } = useWidgetData<Weather>(instance);
  const [isEditing, setIsEditing] = useState(false);
  const city = String(instance.config.city ?? "");

  return (
    <WidgetFrame
      // the found place when ready, else the city typed: never the previous city's name next to an error
      title={status === "ready" && data ? `${data.city}, ${data.country}` : city || "Weather"}
      onRemove={onRemove}
      onDuplicate={onDuplicate}
      dragHandle={dragHandle}
      // always there, errors included: an unknown city must stay fixable
      actions={
        <>
          <button type="button" style={frameActionButtonStyle} aria-expanded={isEditing} onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? "Close" : "Settings"}
          </button>
          {/* reads again right now, without waiting for the timer. off while a read is running */}
          <button type="button" style={frameActionButtonStyle} onClick={() => void refresh()} disabled={status === "loading" || isRefreshing}>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </>
      }
    >
      {isEditing && <SettingsPanel instance={instance} fields={WEATHER_FIELDS} onUpdate={onUpdate} onClose={() => setIsEditing(false)} />}
      {status === "loading" && <div style={widgetMessageStyle}>Loading...</div>}
      {status === "error" && <div style={widgetMessageStyle}>{message}</div>}
      {status === "ready" && data && (
        <div style={weatherBodyStyle}>
          <div style={weatherMainStyle}>
            <img src={weatherIcon(data.icon)} alt={data.label} style={weatherIconStyle} />
            <p style={weatherTempStyle}>
              {Math.round(data.temperature)} {data.units.temperature}
            </p>
          </div>
          <p style={weatherLabelStyle}>{data.label}</p>
          {/* alt="": the text next to each small icon already says what it is */}
          <div style={weatherDetailsStyle}>
            <span style={weatherDetailStyle}>
              <img src={humidityIcon} alt="" style={weatherSmallIconStyle} />
              Humidity {data.humidity} %
            </span>
            <span style={weatherDetailStyle}>
              <img src={windIcon} alt="" style={weatherSmallIconStyle} />
              Wind {Math.round(data.wind)} {data.units.wind}
            </span>
          </div>
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
