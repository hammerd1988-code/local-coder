import * as React from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { Plus, X } from 'lucide-react';
import { OpsPanel, StatusDot } from './OpsPanel';
import { useNode } from './NodeContext';

interface Session {
  id: string;
  label: string;
}

function CyberTerm({ sessionId, active, apiBase }: { sessionId: string; active: boolean; apiBase: string }) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const fitRef = React.useRef<FitAddon | null>(null);
  const termRef = React.useRef<XTerm | null>(null);
  const sockRef = React.useRef<WebSocket | null>(null);
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    if (!hostRef.current) return;
    let disposed = false;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'Share Tech Mono', 'JetBrains Mono', Consolas, monospace",
      theme: {
        background: '#04060c',
        foreground: '#b8e6f5',
        cursor: '#00f0ff',
        cursorAccent: '#04060c',
        selectionBackground: '#0f3550',
        black: '#0a0f1a',
        red: '#ff3b5b',
        green: '#39ff88',
        yellow: '#fcee0a',
        blue: '#00a2ff',
        magenta: '#ff2bd6',
        cyan: '#00f0ff',
        white: '#d7f6ff',
        brightBlack: '#4a6b8a',
        brightRed: '#ff7791',
        brightGreen: '#8affbe',
        brightYellow: '#fdf56a',
        brightBlue: '#5cc4ff',
        brightMagenta: '#ff7de6',
        brightCyan: '#7df7ff',
        brightWhite: '#ffffff',
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    (async () => {
      let token = '';
      try {
        const res = await fetch(`${apiBase}/api/terminal/token`);
        token = (await res.json()).token;
      } catch {
        term.writeln('\r\n\x1b[1;31m✖ AUTH LINK FAILURE — could not fetch session token\x1b[0m');
        return;
      }
      if (disposed) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}${apiBase}/api/terminal?id=${sessionId}&token=${token}&profile=ops&cwd=/`);
      sockRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        term.writeln('\x1b[1;36m┌──────────────────────────────────────────────┐\x1b[0m');
        term.writeln('\x1b[1;36m│\x1b[0m  \x1b[1;35mNETRUNNER CONSOLE\x1b[0m \x1b[2m// direct system shell\x1b[0m   \x1b[1;36m│\x1b[0m');
        term.writeln('\x1b[1;36m│\x1b[0m  \x1b[2muplink established — full host access\x1b[0m       \x1b[1;36m│\x1b[0m');
        term.writeln('\x1b[1;36m└──────────────────────────────────────────────┘\x1b[0m');
        fit.fit();
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      };
      ws.onmessage = (ev) => term.write(ev.data);
      ws.onclose = () => {
        setConnected(false);
        term.writeln('\r\n\x1b[1;33m⚠ UPLINK TERMINATED\x1b[0m');
      };
      ws.onerror = () => setConnected(false);

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data);
      });
    })();

    const onResize = () => {
      fitRef.current?.fit();
      const t = termRef.current;
      const s = sockRef.current;
      if (t && s && s.readyState === WebSocket.OPEN) {
        s.send(JSON.stringify({ type: 'resize', cols: t.cols, rows: t.rows }));
      }
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(hostRef.current);
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      sockRef.current?.close();
      term.dispose();
    };
  }, [sessionId, apiBase]);

  React.useEffect(() => {
    if (active) setTimeout(() => fitRef.current?.fit(), 60);
  }, [active]);

  return (
    <div className={`h-full min-h-0 ${active ? 'flex flex-col' : 'hidden'}`}>
      <div className="px-3 py-1 shrink-0 flex justify-end">
        <StatusDot ok={connected} label={connected ? 'UPLINK ACTIVE' : 'NO CARRIER'} />
      </div>
      <div ref={hostRef} className="flex-1 min-h-0 px-2 pb-2" />
    </div>
  );
}

export function OpsTerminal() {
  const { apiBase } = useNode();
  const [sessions, setSessions] = React.useState<Session[]>([{ id: `ops-${Date.now()}`, label: 'SHELL-01' }]);
  const [activeId, setActiveId] = React.useState(sessions[0].id);
  const counter = React.useRef(1);

  const addSession = () => {
    counter.current += 1;
    const s = { id: `ops-${Date.now()}-${counter.current}`, label: `SHELL-${String(counter.current).padStart(2, '0')}` };
    setSessions((prev) => [...prev, s]);
    setActiveId(s.id);
  };

  const closeSession = (id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        counter.current += 1;
        const s = { id: `ops-${Date.now()}-${counter.current}`, label: `SHELL-${String(counter.current).padStart(2, '0')}` };
        setActiveId(s.id);
        return [s];
      }
      if (id === activeId) setActiveId(next[next.length - 1].id);
      return next;
    });
  };

  return (
    <div className="h-full p-3">
      <OpsPanel
        title="Netrunner Console // PTY"
        className="h-full"
        accent="magenta"
        right={
          <div className="flex items-center gap-1">
            {sessions.map((s) => (
              <span
                key={s.id}
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] tracking-widest cursor-pointer border ${
                  s.id === activeId ? 'ops-glow-magenta border-pink-500/50' : 'border-cyan-400/15'
                }`}
                style={s.id === activeId ? { background: 'rgba(255,43,214,0.08)' } : { color: 'var(--ops-dim)' }}
                onClick={() => setActiveId(s.id)}
              >
                {s.label}
                <X
                  size={10}
                  className="hover:text-red-400"
                  onClick={(e) => { e.stopPropagation(); closeSession(s.id); }}
                />
              </span>
            ))}
            <button className="ops-btn ops-btn-magenta !px-1.5 !py-0.5" onClick={addSession} title="New session">
              <Plus size={11} />
            </button>
          </div>
        }
        bodyClassName="min-h-0"
      >
        {sessions.map((s) => (
          <CyberTerm key={s.id} sessionId={s.id} active={s.id === activeId} apiBase={apiBase} />
        ))}
      </OpsPanel>
    </div>
  );
}
