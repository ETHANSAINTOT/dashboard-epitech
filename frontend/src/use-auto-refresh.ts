import { useEffect, useRef } from "react";
import { REFRESH_MIN_SECONDS } from "./refresh";

// calls refresh every refreshSeconds while enabled. shared by the cards that refresh on a timer (weather...)
// a setTimeout chain, not setInterval: the next tick is planned once the answer is back, so 2 reads never overlap
export function useAutoRefresh(refresh: () => Promise<void>, refreshSeconds: number, enabled = true) {
  // never below the floor, even with a bad value: 0 here would call the api in a loop
  const delayMs = Math.round(Math.max(refreshSeconds, REFRESH_MIN_SECONDS) * 1000);
  // always call the newest version of refresh, without restarting the timer at each render
  const latest = useRef(refresh);
  // updated in an effect: react does not want a ref written during the render itself
  useEffect(() => {
    latest.current = refresh;
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: number | undefined;
    const tick = async () => {
      // hidden tab: skip this tick, no api call for nobody
      if (!document.hidden) await latest.current();
      // cleaned up during the read (delay changed, card removed): plan nothing, or 2 timers would run
      if (!cancelled) timer = window.setTimeout(tick, delayMs);
    };
    timer = window.setTimeout(tick, delayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [delayMs, enabled]);
}
