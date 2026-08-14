import * as React from 'react';
import { RefreshCw, Play, Square, RotateCw } from 'lucide-react';
import { OpsPanel, StatusDot } from './OpsPanel';
import { opsGet, opsPost, type ServiceInfo } from '@/lib/ops';

export function OpsServices() {
  const [services, setServices] = React.useState<ServiceInfo[]>([]);
  const [manager, setManager] = React.useState<string>('');
  const [filter, setFilter] = React.useState('');
  const [selected, setSelected] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [acting, setActing] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await opsGet<{ manager: string; services: ServiceInfo[] }>('/api/system/services');
      setServices(data.services);
      setManager(data.manager);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const act = async (action: string) => {
    if (!selected) return;
    setActing(true);
    setNotice('');
    setError('');
    try {
      await opsPost(`/api/system/services/${encodeURIComponent(selected)}/${action}`);
      setNotice(`${action.toUpperCase()} ${selected} — OK`);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActing(false);
    }
  };

  const shown = services.filter(
    (s) => !filter || s.name.toLowerCase().includes(filter.toLowerCase()) || s.description.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="h-full p-3">
      <OpsPanel
        title={`Daemon Control // ${manager === 'systemd' ? 'systemd' : manager === 'sysv' ? 'sysv init' : 'no init detected'}`}
        className="h-full"
        right={
          <div className="flex items-center gap-1.5">
            <input className="ops-input w-44" placeholder="scan daemons…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <button className="ops-btn !px-2" onClick={load}><RefreshCw size={11} className={loading ? 'animate-spin' : ''} /></button>
            <button className="ops-btn" disabled={!selected || acting} onClick={() => act('start')}><Play size={11} className="inline mr-1" />Start</button>
            <button className="ops-btn" disabled={!selected || acting} onClick={() => act('restart')}><RotateCw size={11} className="inline mr-1" />Restart</button>
            <button className="ops-btn ops-btn-red" disabled={!selected || acting} onClick={() => act('stop')}><Square size={11} className="inline mr-1" />Stop</button>
          </div>
        }
        bodyClassName="flex flex-col min-h-0"
      >
        {error && <div className="px-3 py-1 text-[11px] ops-glow-red shrink-0">⚠ {error}</div>}
        {notice && <div className="px-3 py-1 text-[11px] ops-glow-green shrink-0">✓ {notice}</div>}
        {manager === 'none' ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="ops-display ops-glow-magenta text-lg ops-flicker">INIT SYSTEM OFFLINE</div>
            <div className="text-xs max-w-md text-center" style={{ color: 'var(--ops-dim)' }}>
              No systemd or sysv init manager was detected in this environment (common inside containers).
              Use the NETRUNNER CONSOLE to manage processes directly.
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto min-h-0">
            <table className="ops-table">
              <thead>
                <tr><th>Status</th><th>Daemon</th><th>Load</th><th>State</th><th>Description</th></tr>
              </thead>
              <tbody>
                {shown.map((s) => (
                  <tr
                    key={s.name}
                    className="cursor-pointer"
                    style={selected === s.name ? { background: 'rgba(0,240,255,0.12)' } : undefined}
                    onClick={() => setSelected(s.name === selected ? null : s.name)}
                  >
                    <td><StatusDot ok={s.active === 'active'} /></td>
                    <td className="ops-glow-cyan">{s.name}</td>
                    <td style={{ color: 'var(--ops-dim)' }}>{s.load}</td>
                    <td style={{ color: s.active === 'active' ? 'var(--ops-green)' : s.active === 'failed' ? 'var(--ops-red)' : 'var(--ops-dim)' }}>
                      {s.active}/{s.sub}
                    </td>
                    <td className="max-w-[480px] truncate" style={{ color: '#9fd4e8' }}>{s.description}</td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-6" style={{ color: 'var(--ops-dim)' }}>NO DAEMONS MATCHED</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </OpsPanel>
    </div>
  );
}
