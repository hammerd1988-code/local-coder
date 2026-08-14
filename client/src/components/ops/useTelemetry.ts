import * as React from 'react';
import type { TelemetryFrame } from '@/lib/ops';

const HISTORY = 60;

export function useTelemetry() {
  const [frame, setFrame] = React.useState<TelemetryFrame | null>(null);
  const [history, setHistory] = React.useState<TelemetryFrame[]>([]);
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      source = new EventSource('/api/system/stream');
      source.onopen = () => setConnected(true);
      source.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as TelemetryFrame;
          setFrame(data);
          setHistory((prev) => {
            const next = [...prev, data];
            return next.length > HISTORY ? next.slice(next.length - HISTORY) : next;
          });
        } catch { /* malformed frame */ }
      };
      source.onerror = () => {
        setConnected(false);
        source?.close();
        retryTimer = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      disposed = true;
      source?.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  return { frame, history, connected };
}
