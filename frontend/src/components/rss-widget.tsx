import { useState } from "react";
import {
  frameActionButtonStyle,
  rssDateStyle,
  rssDescriptionStyle,
  rssFooterStyle,
  rssItemStyle,
  rssListStyle,
  rssTitleStyle,
  widgetMessageStyle,
} from "../styles";
import { useWidgetData } from "../use-widget-data";
import SettingsPanel, { type SettingsField } from "./settings-panel";
import WidgetFrame, { type WidgetComponentProps } from "./widget-frame";

// what GET /widgets/{id}/data answers for article_list (backend/catalog/rss.py)
type Article = { title: string; description: string; link: string; date: string | null };
type Feed = { feed: string; articles: Article[] };

// what the Settings panel and the add window show, on top of the refresh interval. "number" is not shown, it is kept as it is
export const RSS_FIELDS: SettingsField[] = [{ key: "link", label: "Feed link (RSS or Atom)", maxLength: 2000 }];

// "06/10 · 14:53" in the user's time zone. en-GB puts the day before the month, like in French
const formatDate = (iso: string) => {
  const date = new Date(iso);
  const day = date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" });
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
};

export default function RssWidget({ instance, onRemove, onDuplicate, onUpdate, dragHandle }: WidgetComponentProps) {
  const { status, message, data, updatedAt, isRefreshing, refresh } = useWidgetData<Feed>(instance);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <WidgetFrame
      // the feed's own name when ready ("franceinfo - Les Titres"), never the old feed's name next to an error
      title={status === "ready" && data ? data.feed : "News"}
      onRemove={onRemove}
      onDuplicate={onDuplicate}
      dragHandle={dragHandle}
      // always there, errors included: a wrong link must stay fixable
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
      {isEditing && <SettingsPanel instance={instance} fields={RSS_FIELDS} onUpdate={onUpdate} onClose={() => setIsEditing(false)} />}
      {status === "loading" && <div style={widgetMessageStyle}>Loading...</div>}
      {status === "error" && <div style={widgetMessageStyle}>{message}</div>}
      {status === "ready" && data && (
        <>
          <ul style={rssListStyle}>
            {/* the items hold no state: the index is a fine key, and 2 articles of a feed may share a link */}
            {data.articles.map((article, index) => (
              <li key={index} style={rssItemStyle}>
                {/* link is "" when the feed gave a non web one (javascript:...): the title only, not clickable */}
                {article.link ? (
                  <a href={article.link} target="_blank" rel="noreferrer" style={rssTitleStyle}>
                    {article.title}
                  </a>
                ) : (
                  <span style={rssTitleStyle}>{article.title}</span>
                )}
                {article.description && <p style={rssDescriptionStyle}>{article.description}</p>}
                {/* dateTime keeps the exact date for screen readers */}
                {article.date && (
                  <time dateTime={article.date} style={rssDateStyle}>
                    {formatDate(article.date)}
                  </time>
                )}
              </li>
            ))}
          </ul>
          <p style={rssFooterStyle}>Updated {updatedAt}</p>
        </>
      )}
    </WidgetFrame>
  );
}
