import * as React from 'react';
import type { TelemetryFrame } from '@/lib/ops';

const HISTORY = 60;
const OUTAGE_HISTORY_RESET_MS = 10_000;

export function useTelemetry(apiBase = '') {
  const [frame, setFrame] = React.useState<TelemetryFrame | null>(null);
  const [history, setHistory] = React.useState<TelemetryFrame[]>([]);
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    let disconnectedAt: number | null = null;
    let outageHistoryCleared = false;
    setFrame(null);
    setHistory([]);
    setConnected(false);

    const clearHistoryAfterLongOutage = () => {
      if (disconnectedAt === null || outageHistoryCleared
        || Date.now() - disconnectedAt < OUTAGE_HISTORY_RESET_MS) return;
      outageHistoryCleared = true;
      setHistory([]);
    };

    const connect = () => {
      if (disposed) return;
      clearHistoryAfterLongOutage();
      const connection = new EventSource(`${apiBase}/api/system/stream`);
      source = connection;
      connection.onopen = () => {
        if (disposed || source !== connection) return;
        setConnected(true);
      };
      connection.onmessage = (ev) => {
        if (disposed || source !== connection) return;
        try {
          const data = JSON.parse(ev.data) as TelemetryFrame;
          clearHistoryAfterLongOutage();
          disconnectedAt = null;
          outageHistoryCleared = false;
          setFrame(data);
          setHistory((prev) => {
            const next = [...prev, data];
            return next.length > HISTORY ? next.slice(next.length - HISTORY) : next;
          });
        } catch { /* malformed frame */ }
      };
      connection.onerror = () => {
        if (disposed || source !== connection) return;
        setConnected(false);
        setFrame(null);
        if (disconnectedAt === null) disconnectedAt = Date.now();
        connection.close();
        source = null;
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      disposed = true;
      source?.close();
      source = null;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [apiBase]);

  return { frame, history, connected };
}
