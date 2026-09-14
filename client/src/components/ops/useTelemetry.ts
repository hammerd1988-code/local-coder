import * as React from 'react';
import type { TelemetryFrame } from '@/lib/ops';

const HISTORY = 60;

export function useTelemetry(apiBase = '') {
  const [frame, setFrame] = React.useState<TelemetryFrame | null>(null);
  const [history, setHistory] = React.useState<TelemetryFrame[]>([]);
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    setFrame(null);
    setHistory([]);
    setConnected(false);

    const connect = () => {
      if (disposed) return;
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
        setHistory([]);
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
