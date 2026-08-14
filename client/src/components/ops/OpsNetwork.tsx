import * as React from 'react';
import { RefreshCw, Wifi, Radio } from 'lucide-react';
import { OpsPanel } from './OpsPanel';
import { opsGet, formatBytes } from '@/lib/ops';

interface IfaceInfo {
  name: string;
  addresses: { address: string; family: string; internal: boolean; mac: string }[];
  rxBytes: number;
  txBytes: number;
}

interface SocketInfo {
  proto: string;
  state: string;
  local: string;
  peer: string;
  process: string;
}

export function OpsNetwork() {
  const [interfaces, setInterfaces] = React.useState<IfaceInfo[]>([]);
  const [sockets, setSockets] = React.useState<SocketInfo[]>([]);
  const [filter, setFilter] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await opsGet<{ interfaces: IfaceInfo[]; sockets: SocketInfo[] }>('/api/system/network');
      setInterfaces(data.interfaces);
      setSockets(data.sockets);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  const shownSockets = sockets.filter(
    (s) => !filter || s.local.includes(filter) || s.process.toLowerCase().includes(filter.toLowerCase()) || s.proto.includes(filter),
  );

  return (
    <div className="h-full p-3 flex flex-col gap-3 min-h-0">
      <OpsPanel title="Interfaces // Uplinks" className="shrink-0" bodyClassName="p-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {interfaces.map((iface) => (
          <div key={iface.name} className="border border-cyan-400/10 p-2.5 relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <span className="inline-flex items-center gap-2 ops-glow-cyan text-xs uppercase tracking-widest">
                {iface.name === 'lo' ? <Radio size={12} /> : <Wifi size={12} />}
                {iface.name}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--ops-dim)' }}>{iface.addresses[0]?.mac ?? ''}</span>
            </div>
            {iface.addresses.map((a) => (
              <div key={a.address} className="text-[11px] flex justify-between">
                <span style={{ color: 'var(--ops-dim)' }}>{a.family}</span>
                <span style={{ color: a.internal ? 'var(--ops-dim)' : 'var(--ops-green)' }}>{a.address}</span>
              </div>
            ))}
            <div className="flex justify-between text-[10px] mt-1.5 pt-1.5 border-t border-cyan-400/10">
              <span className="ops-glow-cyan">▼ {formatBytes(iface.rxBytes)}</span>
              <span className="ops-glow-magenta">▲ {formatBytes(iface.txBytes)}</span>
            </div>
          </div>
        ))}
        {interfaces.length === 0 && <div className="text-xs" style={{ color: 'var(--ops-dim)' }}>NO UPLINKS</div>}
      </OpsPanel>

      <OpsPanel
        title={`Sockets // ${sockets.length} open`}
        accent="magenta"
        className="flex-1"
        right={
          <div className="flex items-center gap-1.5">
            <input className="ops-input w-44" placeholder="filter ports…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <button className="ops-btn !px-2" onClick={load}><RefreshCw size={11} className={loading ? 'animate-spin' : ''} /></button>
          </div>
        }
        bodyClassName="flex flex-col min-h-0"
      >
        {error && <div className="px-3 py-1 text-[11px] ops-glow-red shrink-0">⚠ {error}</div>}
        <div className="flex-1 overflow-auto min-h-0">
          <table className="ops-table">
            <thead>
              <tr><th>Proto</th><th>State</th><th>Local Endpoint</th><th>Peer</th><th>Process</th></tr>
            </thead>
            <tbody>
              {shownSockets.map((s, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--ops-yellow)' }}>{s.proto}</td>
                  <td style={{ color: s.state === 'LISTEN' ? 'var(--ops-green)' : s.state === 'ESTAB' ? 'var(--ops-cyan)' : 'var(--ops-dim)' }}>{s.state}</td>
                  <td className="ops-glow-cyan">{s.local}</td>
                  <td style={{ color: 'var(--ops-dim)' }}>{s.peer}</td>
                  <td style={{ color: 'var(--ops-magenta)' }}>{s.process}</td>
                </tr>
              ))}
              {shownSockets.length === 0 && (
                <tr><td colSpan={5} className="text-center py-6" style={{ color: 'var(--ops-dim)' }}>NO SOCKETS VISIBLE</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </OpsPanel>
    </div>
  );
}
