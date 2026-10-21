import { useEffect, useRef, useState } from "react";
import { api, ApiError, type WidgetInstance } from "./api";
import { useAutoRefresh } from "./use-auto-refresh";

// loads GET /widgets/{id}/data, again when a setting is saved, and on the refresh timer. shared by every card that reads data
export function useWidgetData<T>(instance: WidgetInstance) {
  // "disconnected": the widget needs a connected account (gmail) and has none
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "disconnected">("loading");
  const [message, setMessage] = useState("");
  const [data, setData] = useState<T | null>(null);
  // the connected address (gmail), null for the widgets without an account
  const [account, setAccount] = useState<string | null>(null);
  // when the server read it (fetchedAt): shows the timer is working
  const [updatedAt, setUpdatedAt] = useState("");
  // Refresh button clicked, answer not back yet
  const [isRefreshing, setIsRefreshing] = useState(false);
  // number of the last read: a late answer for the old setting must not show up under the new one
  const lastRequest = useRef(0);

  // "first": "Loading..." screen. "tick" (timer) and "manual" (Refresh button): the last data stays on screen
  const load = async (mode: "first" | "tick" | "manual" = "first") => {
    const requestId = ++lastRequest.current;
    if (mode === "first") setStatus("loading");
    if (mode === "manual") setIsRefreshing(true);
    try {
      const response = await api<{ data: T; account: string | null; fetchedAt: string }>(`/widgets/${instance.id}/data`, { auth: true });
      if (requestId !== lastRequest.current) return;
      setData(response.data);
      setAccount(response.account);
      setUpdatedAt(new Date(response.fetchedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
      setStatus("ready");
    } catch (error) {
      if (requestId !== lastRequest.current) return;
      // 403 = no connected account: even on a tick, there is nothing to read until the user connects
      if (error instanceof ApiError && error.status === 403) return setStatus("disconnected");
      setMessage(error instanceof Error ? error.message : "Unknown error");
      // a failed tick keeps the last data, the next one retries. a failed click shows its error: the user asked
      // function form: the timer knows an old status
      setStatus((prev) => (mode === "tick" && prev === "ready" ? prev : "error"));
    } finally {
      // only the last read: an older one ending late must not re-enable the button too early
      if (requestId === lastRequest.current) setIsRefreshing(false);
    }
  };

  // any setting saved (city, link...) -> reloaded by itself. a string: a new config object with the same values reloads nothing
  const configKey = JSON.stringify(instance.config);
  useEffect(() => {
    void load();
  }, [instance.id, configKey]);
  // no timer on a card waiting for its connection: it would only collect 403s
  useAutoRefresh(() => load("tick"), instance.refreshSeconds, status !== "disconnected");

  return { status, message, data, account, updatedAt, isRefreshing, refresh: () => load("manual") };
}
