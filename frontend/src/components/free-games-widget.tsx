import { useState } from "react";
import {
  frameActionButtonStyle,
  freeGameItemStyle,
  freeGameLinkStyle,
  freeGameMetaStyle,
  freeGameNoteLinkStyle,
  freeGameNoteStyle,
  freeGameThumbStyle,
  freeGameTitleStyle,
  rssFooterStyle,
  rssListStyle,
  widgetMessageStyle,
} from "../styles";
import { useWidgetData } from "../use-widget-data";
import SettingsPanel, { type SettingsField } from "./settings-panel";
import WidgetFrame, { type WidgetComponentProps } from "./widget-frame";

// what GET /widgets/{id}/data answers for free_games (backend/catalog/cheapshark.py)
type Game = { title: string; thumb: string; store: string; normalPrice: string; link: string };
type FreeGames = { games: Game[] };

// "number" is the only setting: how many games to show (1 to 20)
const SETTINGS_FIELDS: SettingsField[] = [{ key: "number", label: "Number of games (1-20)", maxLength: 2 }];
// every game free right now, on CheapShark's own site: to check there are really no more
const CHEAPSHARK_FREE_URL = "https://www.cheapshark.com/browse?upperPrice=0";

export default function FreeGamesWidget({ instance, onRemove, onDuplicate, onUpdate, dragHandle }: WidgetComponentProps) {
  const { status, message, data, updatedAt, isRefreshing, refresh } = useWidgetData<FreeGames>(instance);
  const [isEditing, setIsEditing] = useState(false);
  // what the back really asks CheapShark for: the setting kept between 1 and 20, like in backend/catalog/cheapshark.py
  const asked = Math.max(1, Math.min(Number(instance.config.number) || 5, 20));

  return (
    <WidgetFrame
      title="Free games"
      onRemove={onRemove}
      onDuplicate={onDuplicate}
      dragHandle={dragHandle}
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
      {isEditing && <SettingsPanel instance={instance} fields={SETTINGS_FIELDS} onUpdate={onUpdate} onClose={() => setIsEditing(false)} />}
      {status === "loading" && <div style={widgetMessageStyle}>Loading...</div>}
      {status === "error" && <div style={widgetMessageStyle}>{message}</div>}
      {status === "ready" && data && (
        <>
          {data.games.length === 0 ? (
            <div style={widgetMessageStyle}>No free game right now.</div>
          ) : (
            <ul style={rssListStyle}>
              {data.games.map((game, index) => (
                <li key={index} style={freeGameItemStyle}>
                  {game.thumb && <img src={game.thumb} alt="" style={freeGameThumbStyle} loading="lazy" />}
                  <div>
                    <a href={game.link} target="_blank" rel="noreferrer" style={freeGameLinkStyle}>
                      <span style={freeGameTitleStyle}>{game.title}</span>
                    </a>
                    <p style={freeGameMetaStyle}>
                      {game.store} · <s>${game.normalPrice}</s> → Free
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {/* fewer games than asked for: not a bug, CheapShark simply has no more for free right now */}
          {data.games.length < asked && (
            <p style={freeGameNoteStyle}>
              {data.games.length > 0 &&
                `Only ${data.games.length} of the ${asked} games you asked for ${data.games.length === 1 ? "is" : "are"} shown: CheapShark has no other free game right now. `}
              <a href={CHEAPSHARK_FREE_URL} target="_blank" rel="noreferrer" style={freeGameNoteLinkStyle}>
                Check on CheapShark<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </p>
          )}
          <p style={rssFooterStyle}>Updated {updatedAt}</p>
        </>
      )}
    </WidgetFrame>
  );
}
