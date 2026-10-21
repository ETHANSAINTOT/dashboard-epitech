import { useState } from "react";
import { api } from "../api";
import { errorStyle, frameActionButtonStyle, gmailAccountStyle, gmailOpenStyle, widgetButtonStyle, widgetMessageStyle } from "../styles";
import { useWidgetData } from "../use-widget-data";
import GmailInbox, { gmailUrl, type Email } from "./gmail-inbox";
import SettingsPanel, { type SettingsField } from "./settings-panel";
import WidgetFrame, { type WidgetComponentProps } from "./widget-frame";

// the back accepts 1 to 10 (NUMBERS in backend/catalog/gmail.py): a select, nothing to type wrong
export const GMAIL_FIELDS: SettingsField[] = [
  { key: "number", label: "Emails shown", options: Array.from({ length: 10 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) })) },
];

export default function GmailWidget({ instance, onRemove, onDuplicate, onUpdate, dragHandle }: WidgetComponentProps) {
  // "disconnected" when /data answers 403: this widget has no Google account yet
  const { status, message, data, account, isRefreshing, refresh } = useWidgetData<{ emails: Email[] }>(instance);
  const [isEditing, setIsEditing] = useState(false);
  // the "Connect Gmail" request itself failed (server down...): shown under the button
  const [connectError, setConnectError] = useState("");
  // settings, refresh and disconnect only make sense on a connected card
  const isConnected = status === "ready" || status === "error";

  const connect = async () => {
    try {
      // the widget id travels to google and back, so the callback knows which widget to connect
      const { url } = await api<{ url: string }>(`/oauth/google/url?widget=${instance.id}`, { auth: true });
      window.location.href = url;
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : "Unknown error");
    }
  };

  const disconnect = async () => {
    setIsEditing(false);
    await api(`/oauth/google?widget=${instance.id}`, { method: "DELETE", auth: true });
    // the back now answers 403: the card goes back to "Connect Gmail" by itself
    await refresh();
  };

  return (
    <WidgetFrame
      title="Gmail"
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
      {isEditing && isConnected && <SettingsPanel instance={instance} fields={GMAIL_FIELDS} onUpdate={onUpdate} onClose={() => setIsEditing(false)} />}
      {status === "loading" && <div style={widgetMessageStyle}>Loading...</div>}
      {status === "error" && <div style={widgetMessageStyle}>{message}</div>}
      {status === "disconnected" && (
        <div style={widgetMessageStyle}>
          <p>Connect a Google account to view its inbox.</p>
          <button type="button" style={widgetButtonStyle} onClick={() => void connect()}>
            Connect Gmail
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
          {/* tells 2 Gmail cards apart: the title stays "Gmail", a full address would not fit next to the buttons */}
          {account && <p style={gmailAccountStyle}>{account}</p>}
          <GmailInbox emails={data.emails} account={account} />
          {/* under the list, there even when the inbox is empty: the whole mailbox of THIS card's address, in a new tab */}
          <a href={gmailUrl(account)} target="_blank" rel="noreferrer" className="gmail-open" style={gmailOpenStyle}>
            Open Gmail<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </>
      )}
    </WidgetFrame>
  );
}
