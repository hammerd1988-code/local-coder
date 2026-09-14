import * as React from 'react';
import { RefreshCw, ScrollText, Activity } from 'lucide-react';
import { OpsPanel, StatusDot } from './OpsPanel';
import { opsGet, formatBytes } from '@/lib/ops';

interface LogFile {
  name: string;
  path: string;
  size: number;
  mtime: number;
}

type CatalogState = 'loading' | 'ready' | 'unavailable';
type TailState = 'idle' | 'loading' | 'ready' | 'unavailable';

export function OpsLogs() {
  const [files, setFiles] = React.useState<LogFile[]>([]);
  const [sources, setSources] = React.useState<string[]>([]);
  const [active, setActive] = React.useState<{ kind: 'file' | 'source'; id: string } | null>(null);
  const [content, setContent] = React.useState('');
  const [follow, setFollow] = React.useState(true);
  const [lines, setLines] = React.useState(300);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [catalogState, setCatalogState] = React.useState<CatalogState>('loading');
  const [tailState, setTailState] = React.useState<TailState>('idle');
  const viewRef = React.useRef<HTMLPreElement>(null);
  const catalogRequestRef = React.useRef(0);
  const tailRequestRef = React.useRef(0);
  const tailInFlightRef = React.useRef(false);

  const loadCatalog = React.useCallback(async () => {
    const requestId = ++catalogRequestRef.current;
    tailRequestRef.current += 1;
    tailInFlightRef.current = false;
    setFiles([]);
    setSources([]);
    setActive(null);
    setContent('');
    setCatalogState('loading');
    setTailState('idle');
    setLoading(false);
    setError('');
    try {
      const data = await opsGet<{ files: LogFile[]; sources: string[] }>('/api/system/logs');
      if (requestId !== catalogRequestRef.current) return;
      setFiles(data.files);
      setSources(data.sources);
      setCatalogState('ready');
      if (data.sources.length > 0) {
        setTailState('loading');
        setActive({ kind: 'source', id: data.sources[0] });
      } else if (data.files.length > 0) {
        setTailState('loading');
        setActive({ kind: 'file', id: data.files[0].path });
      }
    } catch (err: any) {
      if (requestId !== catalogRequestRef.current) return;
      setCatalogState('unavailable');
      setError(err.message);
    }
  }, []);

  React.useEffect(() => {
    loadCatalog();
    return () => {
      catalogRequestRef.current += 1;
      tailRequestRef.current += 1;
    };
  }, [loadCatalog]);

  const loadTail = React.useCallback(async (supersede = false) => {
    if (tailInFlightRef.current && !supersede) return;
    const requestId = ++tailRequestRef.current;
    if (!active) {
      setContent('');
      setTailState('idle');
      return;
    }
    tailInFlightRef.current = true;
    setLoading(true);
    setContent('');
    setTailState('loading');
    try {
      const qs = active.kind === 'source'
        ? `source=${encodeURIComponent(active.id)}&lines=${lines}`
        : `path=${encodeURIComponent(active.id)}&lines=${lines}`;
      const data = await opsGet<{ content: string }>(`/api/system/logs/tail?${qs}`);
      if (requestId !== tailRequestRef.current) return;
      setContent(data.content);
      setTailState('ready');
      setError('');
    } catch (err: any) {
      if (requestId !== tailRequestRef.current) return;
      setContent('');
      setTailState('unavailable');
      setError(err.message);
    } finally {
      if (requestId === tailRequestRef.current) {
        tailInFlightRef.current = false;
        setLoading(false);
      }
    }
  }, [active, lines]);

  React.useEffect(() => {
    loadTail(true);
    if (!follow) return;
    const t = setInterval(loadTail, 4000);
    return () => {
      clearInterval(t);
      tailRequestRef.current += 1;
      tailInFlightRef.current = false;
    };
  }, [loadTail, follow]);

  React.useEffect(() => {
    if (follow && viewRef.current) {
      viewRef.current.scrollTop = viewRef.current.scrollHeight;
    }
  }, [content, follow]);

  const selectActive = (next: { kind: 'file' | 'source'; id: string }) => {
    setContent('');
    setTailState('loading');
    setError('');
    setActive(next);
  };

  const refreshTail = () => loadTail(true);

  const colorize = (line: string): string => {
    if (/error|fail|fatal|panic|crit/i.test(line)) return 'var(--ops-red)';
    if (/warn/i.test(line)) return 'var(--ops-yellow)';
    if (/info|start|listen|ready|ok\b/i.test(line)) return '#9fd4e8';
    return 'var(--ops-dim)';
  };

  return (
    <div className="h-full p-3 flex gap-3 min-h-0">
      <OpsPanel
        title="Log Sources"
        className="w-72 shrink-0"
        bodyClassName="overflow-y-auto min-h-0"
        right={
          <button className="ops-btn !px-2 !py-0.5" onClick={loadCatalog} title="Refresh sources">
            <RefreshCw size={11} className={catalogState === 'loading' ? 'animate-spin' : ''} />
          </button>
        }
      >
        {sources.map((s) => (
          <button
            key={s}
            className={`ops-nav-item ${active?.kind === 'source' && active.id === s ? 'active' : ''}`}
            onClick={() => selectActive({ kind: 'source', id: s })}
          >
            <Activity size={12} className="ops-nav-icon" />
            {s}
          </button>
        ))}
        {files.map((f) => (
          <button
            key={f.path}
            className={`ops-nav-item ${active?.kind === 'file' && active.id === f.path ? 'active' : ''}`}
            style={{ textTransform: 'none', letterSpacing: '0.04em' }}
            onClick={() => selectActive({ kind: 'file', id: f.path })}
            title={f.path}
          >
            <ScrollText size={12} className="ops-nav-icon shrink-0" />
            <span className="truncate flex-1 text-left">{f.name}</span>
            <span className="text-[9px] shrink-0">{formatBytes(f.size, 0)}</span>
          </button>
        ))}
        {files.length === 0 && sources.length === 0 && (
          <div className="p-3 text-xs" style={{ color: 'var(--ops-dim)' }}>
            {catalogState === 'loading'
              ? 'ACQUIRING LOG SOURCES…'
              : catalogState === 'unavailable'
                ? 'LOG SOURCES UNAVAILABLE'
                : 'NO READABLE LOGS UNDER /var/log'}
          </div>
        )}
      </OpsPanel>

      <OpsPanel
        title={`Tail // ${active ? (active.kind === 'source' ? active.id : active.id.replace('/var/log/', '')) : 'no source'}`}
        accent="magenta"
        className="flex-1"
        right={
          <div className="flex items-center gap-2">
            <StatusDot ok={follow} label={follow ? 'FOLLOWING' : 'PAUSED'} />
            <select
              className="ops-input !py-0.5"
              value={lines}
              onChange={(e) => setLines(parseInt(e.target.value, 10))}
              style={{ clipPath: 'none' }}
            >
              {[100, 300, 500, 1000, 2000].map((n) => <option key={n} value={n}>{n} lines</option>)}
            </select>
            <button className="ops-btn !px-2" onClick={() => setFollow(!follow)}>{follow ? 'Pause' : 'Follow'}</button>
            <button className="ops-btn !px-2" onClick={refreshTail}><RefreshCw size={11} className={loading ? 'animate-spin' : ''} /></button>
          </div>
        }
        bodyClassName="flex flex-col min-h-0"
      >
        {error && <div className="px-3 py-1 text-[11px] ops-glow-red shrink-0">⚠ {error}</div>}
        <pre
          ref={viewRef}
          className="flex-1 overflow-auto min-h-0 p-3 text-[11px] leading-[1.5] whitespace-pre-wrap break-all"
          style={{ fontFamily: "'Share Tech Mono', monospace" }}
        >
          {tailState === 'loading' && <div style={{ color: 'var(--ops-dim)' }}>ACQUIRING LOG DATA…</div>}
          {tailState === 'unavailable' && <div style={{ color: 'var(--ops-red)' }}>LOG DATA UNAVAILABLE</div>}
          {tailState === 'idle' && <div style={{ color: 'var(--ops-dim)' }}>SELECT A LOG SOURCE</div>}
          {tailState === 'ready' && (content
            ? content.split('\n').map((line, i) => (
                <div key={i} style={{ color: colorize(line) }}>{line || ' '}</div>
              ))
            : <div style={{ color: 'var(--ops-dim)' }}>NO LOG OUTPUT</div>)}
        </pre>
      </OpsPanel>
    </div>
  );
}
