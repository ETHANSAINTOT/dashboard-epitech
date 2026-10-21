import { useState } from "react";
import { api } from "../api";
import { errorStyle, frameActionButtonStyle, rssDescriptionStyle, rssFooterStyle, rssItemStyle, rssListStyle, rssTitleStyle, widgetButtonStyle, widgetMessageStyle } from "../styles";
import { useWidgetData } from "../use-widget-data";
import SettingsPanel, { type SettingsField } from "./settings-panel";
import WidgetFrame, { type WidgetComponentProps } from "./widget-frame";

// what GET /widgets/{id}/data answers for repo_list (backend/catalog/github.py)
type Repo = { name: string; url: string; stars: number; language: string; languageColor: string };
type Profile = { name: string; login: string; avatarUrl: string; bio: string; url: string; repos: Repo[] };

// the back accepts 1 to 10 (NUMBERS in backend/catalog/github.py)
export const GITHUB_FIELDS: SettingsField[] = [
  { key: "number", label: "Repositories shown", options: Array.from({ length: 10 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) })) },
];

export default function GithubWidget({ instance, onRemove, onDuplicate, onUpdate, dragHandle }: WidgetComponentProps) {
  // "disconnected" when /data answers 403: this widget has no GitHub account yet
  const { status, message, data, account, updatedAt, isRefreshing, refresh } = useWidgetData<Profile>(instance);
  const [isEditing, setIsEditing] = useState(false);
  const [connectError, setConnectError] = useState("");
  const isConnected = status === "ready" || status === "error";

  const connect = async () => {
    try {
      // the widget id travels to github and back, so the callback knows which widget to connect
      const { url } = await api<{ url: string }>(`/oauth/github/url?widget=${instance.id}`, { auth: true });
      window.location.href = url;
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : "Unknown error");
    }
  };

  const disconnect = async () => {
    setIsEditing(false);
    await api(`/oauth/github?widget=${instance.id}`, { method: "DELETE", auth: true });
    await refresh();
  };

  return (
    <WidgetFrame
      title="GitHub"
      onRemove={onRemove}
      onDuplicate={onDuplicate}
      dragHandle={dragHandle}
      actions={
        isConnected && (
          <>
            <button type="button" style={frameActionButtonStyle} aria-expanded={isEditing} onClick={() => setIsEditing(!isEditing)}>
              {isEditing ? "Close" : "Settings"}
            </button>
            <button type="button" style={frameActionButtonStyle} onClick={() => void refresh()} disabled={isRefreshing}>
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
            <button type="button" style={frameActionButtonStyle} onClick={() => void disconnect()}>
              Disconnect
            </button>
          </>
        )
      }
    >
      {isEditing && isConnected && <SettingsPanel instance={instance} fields={GITHUB_FIELDS} onUpdate={onUpdate} onClose={() => setIsEditing(false)} />}
      {status === "loading" && <div style={widgetMessageStyle}>Loading...</div>}
      {status === "error" && <div style={widgetMessageStyle}>{message}</div>}
      {status === "disconnected" && (
        <div style={widgetMessageStyle}>
          <p>Connect your GitHub account to see your profile and latest repositories.</p>
          <button type="button" style={widgetButtonStyle} onClick={() => void connect()}>
            Connect GitHub
          </button>
          {connectError && (
            <p role="alert" style={errorStyle}>
              {connectError}
            </p>
          )}
        </div>
      )}
      {status === "ready" && data && (
        <>
          {/* tells 2 GitHub cards apart */}
          {account && <p style={{ margin: 0, padding: "6px 16px 0", fontSize: "12px", color: "#666" }}>@{account}</p>}
          <div style={{ display: "flex", gap: "12px", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #f3f3f3" }}>
            <img src={data.avatarUrl} alt="" width={48} height={48} style={{ borderRadius: "50%" }} loading="lazy" />
            <div>
              <a href={data.url} target="_blank" rel="noreferrer" style={rssTitleStyle}>
                {data.name}
              </a>
              {data.bio && <p style={{ ...rssDescriptionStyle, margin: "2px 0 0" }}>{data.bio}</p>}
            </div>
          </div>
          <ul style={rssListStyle}>
            {data.repos.map((repo) => (
              <li key={repo.url} style={rssItemStyle}>
                <a href={repo.url} target="_blank" rel="noreferrer" style={rssTitleStyle}>
                  {repo.name}
                </a>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#666" }}>
                  {"\u2605"} {repo.stars}
                  {repo.language && (
                    <>
                      {" \u00b7 "}
                      <span aria-hidden style={{ color: repo.languageColor }}>{"\u25cf"}</span> {repo.language}
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
          <p style={rssFooterStyle}>Updated {updatedAt}</p>
        </>
      )}
    </WidgetFrame>
  );
}
