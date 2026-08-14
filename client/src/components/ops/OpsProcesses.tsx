import * as React from 'react';
import { RefreshCw, Skull, OctagonX, Play, Pause } from 'lucide-react';
import { OpsPanel } from './OpsPanel';
import { opsGet, opsPost, formatBytes, type ProcessInfo } from '@/lib/ops';

type SortKey = 'pid' | 'user' | 'cpu' | 'mem' | 'rss' | 'command';

export function OpsProcesses() {
  const [processes, setProcesses] = React.useState<ProcessInfo[]>([]);
  const [filter, setFilter] = React.useState('');
  const [sortKey, setSortKey] = React.useState<SortKey>('cpu');
  const [sortDesc, setSortDesc] = React.useState(true);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [error, setError] = React.useState('');
  const [auto, setAuto] = React.useState(true);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await opsGet<{ processes: ProcessInfo[] }>('/api/system/processes');
      setProcesses(data.processes);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    if (!auto) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load, auto]);

  const signal = async (sig: string) => {
    if (selected == null) return;
    const target = processes.find((p) => p.pid === selected);
    if (sig === 'SIGKILL' && !window.confirm(`SIGKILL pid ${selected} (${target?.command.slice(0, 60)})?`)) return;
    try {
      await opsPost(`/api/system/processes/${selected}/signal`, { signal: sig });
      setError('');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const sorted = React.useMemo(() => {
    const f = filter.toLowerCase();
    const filtered = processes.filter(
      (p) => !f || p.command.toLowerCase().includes(f) || p.user.toLowerCase().includes(f) || String(p.pid).includes(f),
    );
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDesc ? -cmp : cmp;
    });
  }, [processes, filter, sortKey, sortDesc]);

  const header = (key: SortKey, label: string) => (
    <th onClick={() => (key === sortKey ? setSortDesc(!sortDesc) : (setSortKey(key), setSortDesc(true)))}>
      {label} {sortKey === key ? (sortDesc ? '▼' : '▲') : ''}
    </th>
  );

  return (
    <div className="h-full p-3">
      <OpsPanel
        title={`Process Grid // ${processes.length} active`}
        className="h-full"
        right={
          <div className="flex items-center gap-1.5">
            <input className="ops-input w-44" placeholder="trace target…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <button className="ops-btn !px-2" title={auto ? 'Pause auto-refresh' : 'Resume auto-refresh'} onClick={() => setAuto(!auto)}>
              {auto ? <Pause size={11} /> : <Play size={11} />}
            </button>
            <button className="ops-btn !px-2" onClick={load} title="Refresh">
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            </button>
            <button className="ops-btn" disabled={selected == null} onClick={() => signal('SIGTERM')}>
              <OctagonX size={11} className="inline mr-1" />Term
            </button>
            <button className="ops-btn ops-btn-red" disabled={selected == null} onClick={() => signal('SIGKILL')}>
              <Skull size={11} className="inline mr-1" />Kill
            </button>
          </div>
        }
        bodyClassName="flex flex-col min-h-0"
      >
        {error && <div className="px-3 py-1 text-[11px] ops-glow-red shrink-0">⚠ {error}</div>}
        <div className="flex-1 overflow-auto min-h-0">
          <table className="ops-table">
            <thead>
              <tr>
                {header('pid', 'PID')}
                {header('user', 'User')}
                {header('cpu', 'CPU%')}
                {header('mem', 'MEM%')}
                {header('rss', 'RSS')}
                <th>Stat</th>
                <th>Uptime</th>
                {header('command', 'Command')}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const hot = p.cpu > 50;
                return (
                  <tr
                    key={p.pid}
                    className="cursor-pointer"
                    style={selected === p.pid ? { background: 'rgba(255,43,214,0.12)' } : undefined}
                    onClick={() => setSelected(p.pid === selected ? null : p.pid)}
                  >
                    <td className="ops-glow-cyan">{p.pid}</td>
                    <td style={{ color: p.user === 'root' ? 'var(--ops-magenta)' : '#d7f6ff' }}>{p.user}</td>
                    <td style={{ color: hot ? 'var(--ops-red)' : p.cpu > 10 ? 'var(--ops-yellow)' : 'var(--ops-green)' }}>
                      {p.cpu.toFixed(1)}
                    </td>
                    <td style={{ color: p.mem > 20 ? 'var(--ops-yellow)' : 'var(--ops-dim)' }}>{p.mem.toFixed(1)}</td>
                    <td style={{ color: 'var(--ops-dim)' }}>{formatBytes(p.rss)}</td>
                    <td style={{ color: 'var(--ops-dim)' }}>{p.stat}</td>
                    <td style={{ color: 'var(--ops-dim)' }}>{p.etime}</td>
                    <td className="max-w-[560px] truncate" title={p.command} style={{ color: '#9fd4e8' }}>
                      {p.command}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-1 text-[10px] border-t border-cyan-400/10 shrink-0 flex justify-between" style={{ color: 'var(--ops-dim)' }}>
          <span>{sorted.length} traced</span>
          <span>{selected != null ? `TARGET LOCKED: PID ${selected}` : 'select a row to arm signals'}</span>
        </div>
      </OpsPanel>
    </div>
  );
}
