import type { ComponentType } from "react";
import type { WidgetInstance } from "./api";
import ClockWidget, { CLOCK_FIELDS } from "./components/clock-widget";
import FreeGamesWidget from "./components/free-games-widget";
import ForecastWidget, { FORECAST_FIELDS } from "./components/forecast-widget";
import GithubWidget, { GITHUB_FIELDS } from "./components/github-widget";
import GmailWidget, { GMAIL_FIELDS } from "./components/gmail-widget";
import RssWidget, { RSS_FIELDS } from "./components/rss-widget";
import TranslateWidget, { TRANSLATE_FIELDS } from "./components/translate-widget";
import WeatherWidget, { WEATHER_FIELDS } from "./components/weather-widget";
import type { WidgetComponentProps } from "./components/widget-frame";
import type { SettingsField } from "./components/widget-form";

export type WidgetType = {
  id: string;
  // serviceName and widgetName must match the backend catalogue exactly (see /about.json)
  serviceName: string;
  widgetName: string;
  label: string;
  description: string;
  defaultConfig: Record<string, unknown>;
  defaultRefreshSeconds?: number;
  // given = "+ Add" opens a window to fill them first (+ the refresh). none = added straight away (gmail)
  fields?: SettingsField[];
  // true: the add window does not ask for the refresh (translate)
  hideRefresh?: boolean;
  Component: ComponentType<WidgetComponentProps>;
};

export const WIDGET_TYPES: WidgetType[] = [
  {
    id: "clock",
    serviceName: "clock",
    widgetName: "current_time",
    label: "Clock",
    description: "Paris time",
    defaultConfig: { city: "Paris" },
    // the seconds tick in the browser: a refresh only re-syncs with the server clock and the time zone (summer time)
    defaultRefreshSeconds: 3600,
    fields: CLOCK_FIELDS,
    Component: ClockWidget,
  },
  {
    id: "gmail",
    serviceName: "gmail",
    widgetName: "inbox",
    label: "Gmail",
    description: "Latest emails",
    defaultConfig: { number: 5 },
    defaultRefreshSeconds: 300,
    fields: GMAIL_FIELDS,
    Component: GmailWidget,
  },
  {
    id: "translate",
    serviceName: "translate",
    widgetName: "text",
    label: "Translate",
    description: "English → French",
    // every "+ Add" starts from English -> French, whatever the other translators use
    defaultConfig: { source: "en", target: "fr" },
    // unused (a translation runs when you type, not on a timer) but the back wants one, 10 s minimum
    defaultRefreshSeconds: 300,
    fields: TRANSLATE_FIELDS,
    hideRefresh: true,
    Component: TranslateWidget,
  },
  {
    id: "weather",
    serviceName: "weather",
    widgetName: "city_temperature",
    label: "Weather",
    description: "Current weather",
    defaultConfig: { city: "Lille", units: "metric" },
    // Open-Meteo updates the current weather every 15 min: refreshing more often shows nothing new
    defaultRefreshSeconds: 900,
    fields: WEATHER_FIELDS,
    Component: WeatherWidget,
  },
  {
    id: "forecast",
    serviceName: "weather",
    widgetName: "city_forecast",
    label: "Forecast",
    description: "Next days",
    // always these values: "+ Add" never reuses the city of another weather card
    defaultConfig: { city: "Lille", units: "metric", days: 5 },
    // a daily forecast changes a few times a day: 1 h is plenty, and saves the Open-Meteo quota shared with the weather card
    defaultRefreshSeconds: 3600,
    fields: FORECAST_FIELDS,
    Component: ForecastWidget,
  },
  {
    id: "rss",
    serviceName: "rss",
    widgetName: "article_list",
    label: "News",
    description: "RSS headlines",
    defaultConfig: { link: "https://www.franceinfo.fr/titres.rss", number: 5 },
    // news move fast, but every refresh downloads the whole feed (~38 KB for franceinfo): 5 min is fair
    defaultRefreshSeconds: 300,
    fields: RSS_FIELDS,
    Component: RssWidget,
  },
  {
    id: "free-games",
    serviceName: "cheapshark",
    widgetName: "free_games",
    label: "Free games",
    description: "Free right now (CheapShark)",
    defaultConfig: { number: 5 },
    // free offers last days: 30 min is plenty
    defaultRefreshSeconds: 1800,
    Component: FreeGamesWidget,
  },
  {
    id: "github",
    serviceName: "github",
    widgetName: "repo_list",
    label: "GitHub",
    description: "Profile and latest repos",
    defaultConfig: { number: 5 },
    // repos change a few times a day: 10 min keeps well under the 5000 points/h GraphQL quota
    defaultRefreshSeconds: 600,
    fields: GITHUB_FIELDS,
    Component: GithubWidget,
  },
];

// both names must match: the weather service has 2 widgets (current, forecast), each with its own card
export function findWidgetType(instance: WidgetInstance) {
  return WIDGET_TYPES.find(
    (type) => type.serviceName === instance.serviceName && type.widgetName === instance.widgetName
  );
}
