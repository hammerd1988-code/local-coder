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

export function OpsLogs() {
  const [files, setFiles] = React.useState<LogFile[]>([]);
  const [sources, setSources] = React.useState<string[]>([]);
  const [active, setActive] = React.useState<{ kind: 'file' | 'source'; id: string } | null>(null);
  const [content, setContent] = React.useState('');
  const [follow, setFollow] = React.useState(true);
  const [lines, setLines] = React.useState(300);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const viewRef = React.useRef<HTMLPreElement>(null);

  React.useEffect(() => {
    opsGet<{ files: LogFile[]; sources: string[] }>('/api/system/logs')
      .then((d) => {
        setFiles(d.files);
        setSources(d.sources);
        if (d.sources.length > 0) setActive({ kind: 'source', id: d.sources[0] });
        else if (d.files.length > 0) setActive({ kind: 'file', id: d.files[0].path });
      })
      .catch((err) => setError(err.message));
  }, []);

  const loadTail = React.useCallback(async () => {
    if (!active) return;
    setLoading(true);
    try {
      const qs = active.kind === 'source'
        ? `source=${encodeURIComponent(active.id)}&lines=${lines}`
        : `path=${encodeURIComponent(active.id)}&lines=${lines}`;
      const data = await opsGet<{ content: string }>(`/api/system/logs/tail?${qs}`);
      setContent(data.content);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [active, lines]);

  React.useEffect(() => {
    loadTail();
    if (!follow) return;
    const t = setInterval(loadTail, 4000);
    return () => clearInterval(t);
  }, [loadTail, follow]);

  React.useEffect(() => {
    if (follow && viewRef.current) {
      viewRef.current.scrollTop = viewRef.current.scrollHeight;
    }
  }, [content, follow]);

  const colorize = (line: string): string => {
    if (/error|fail|fatal|panic|crit/i.test(line)) return 'var(--ops-red)';
    if (/warn/i.test(line)) return 'var(--ops-yellow)';
    if (/info|start|listen|ready|ok\b/i.test(line)) return '#9fd4e8';
    return 'var(--ops-dim)';
  };

  return (
    <div className="h-full p-3 flex gap-3 min-h-0">
      <OpsPanel title="Log Sources" className="w-72 shrink-0" bodyClassName="overflow-y-auto min-h-0">
        {sources.map((s) => (
          <button
            key={s}
            className={`ops-nav-item ${active?.kind === 'source' && active.id === s ? 'active' : ''}`}
            onClick={() => setActive({ kind: 'source', id: s })}
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
            onClick={() => setActive({ kind: 'file', id: f.path })}
            title={f.path}
          >
            <ScrollText size={12} className="ops-nav-icon shrink-0" />
            <span className="truncate flex-1 text-left">{f.name}</span>
            <span className="text-[9px] shrink-0">{formatBytes(f.size, 0)}</span>
          </button>
        ))}
        {files.length === 0 && sources.length === 0 && (
          <div className="p-3 text-xs" style={{ color: 'var(--ops-dim)' }}>NO READABLE LOGS UNDER /var/log</div>
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
            <button className="ops-btn !px-2" onClick={loadTail}><RefreshCw size={11} className={loading ? 'animate-spin' : ''} /></button>
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
          {content.split('\n').map((line, i) => (
            <div key={i} style={{ color: colorize(line) }}>{line || ' '}</div>
          ))}
        </pre>
      </OpsPanel>
    </div>
  );
}
