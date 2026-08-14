import * as React from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { OpsPanel, StatusDot } from './OpsPanel';
import { Gauge } from './Gauge';
import { useTelemetry } from './useTelemetry';
import { opsGet, formatBytes, formatRate, formatUptime, formatTimestamp, type Overview, type DiskInfo, type TelemetryFrame } from '@/lib/ops';

function InfoRow({ k, v, accent }: { k: string; v: React.ReactNode; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-[3px] border-b border-cyan-400/5 text-[11px]">
      <span className="uppercase tracking-widest" style={{ color: 'var(--ops-dim)' }}>{k}</span>
      <span className={`text-right truncate ${accent ? 'ops-glow-cyan' : ''}`} style={accent ? undefined : { color: '#d7f6ff' }}>{v}</span>
    </div>
  );
}

function CoreBars({ cores }: { cores: number[] }) {
  return (
    <div className="grid gap-1.5 p-3" style={{ gridTemplateColumns: `repeat(${Math.min(cores.length, 8)}, 1fr)` }}>
      {cores.map((c, i) => {
        const color = c > 90 ? 'var(--ops-red)' : c > 70 ? 'var(--ops-yellow)' : 'var(--ops-cyan)';
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="relative w-full h-16 bg-cyan-950/40 border border-cyan-400/10 overflow-hidden">
              <div
                className="absolute bottom-0 left-0 right-0 transition-all duration-500"
                style={{
                  height: `${Math.max(2, c)}%`,
                  background: `linear-gradient(180deg, ${color}, transparent)`,
                  boxShadow: `0 0 8px ${color}`,
                }}
              />
            </div>
            <span className="text-[9px]" style={{ color: 'var(--ops-dim)' }}>C{i}</span>
          </div>
        );
      })}
    </div>
  );
}

function NeonTooltip({ active, payload, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="ops-panel px-2 py-1 text-[10px]" style={{ background: 'rgba(4,10,20,0.95)' }}>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.stroke }}>
          {p.name}: {formatter ? formatter(p.value) : p.value}
        </div>
      ))}
    </div>
  );
}

export function OpsDashboard() {
  const { frame, history, connected } = useTelemetry();
  const [overview, setOverview] = React.useState<Overview | null>(null);
  const [disks, setDisks] = React.useState<DiskInfo[]>([]);

  React.useEffect(() => {
    opsGet<Overview>('/api/system/overview').then(setOverview).catch(() => {});
    const load = () => opsGet<{ disks: DiskInfo[] }>('/api/system/disks').then((d) => setDisks(d.disks)).catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const memPct = frame ? (frame.mem.used / Math.max(1, frame.mem.total)) * 100 : 0;
  const swapPct = frame && frame.mem.swapTotal > 0 ? (frame.mem.swapUsed / frame.mem.swapTotal) * 100 : 0;

  const cpuData = history.map((h: TelemetryFrame) => ({ t: h.t, cpu: h.cpu }));
  const netData = history.map((h: TelemetryFrame) => ({ t: h.t, rx: h.net.rx, tx: h.net.tx }));
  const ioData = history.map((h: TelemetryFrame) => ({ t: h.t, read: h.io.read, write: h.io.write }));

  return (
    <div className="h-full overflow-y-auto p-3 grid gap-3 content-start"
      style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>

      {/* Host identity */}
      <OpsPanel title="Host // Identity" className="col-span-12 lg:col-span-4" bodyClassName="p-3">
        {overview ? (
          <>
            <div className="ops-display text-lg ops-glow-cyan mb-2 truncate">{overview.hostname}</div>
            <InfoRow k="OS" v={overview.distro} />
            <InfoRow k="Kernel" v={overview.kernel} />
            <InfoRow k="Arch" v={overview.arch} />
            <InfoRow k="CPU" v={`${overview.cpu.model.slice(0, 34)} ×${overview.cpu.cores}`} />
            <InfoRow k="Memory" v={formatBytes(overview.memory.total)} />
            <InfoRow k="Operator" v={overview.user} accent />
            <InfoRow k="Boot" v={formatTimestamp(overview.bootTime)} />
            {overview.addresses.slice(0, 3).map((a) => (
              <InfoRow key={a.iface + a.address} k={a.iface} v={a.address} accent />
            ))}
          </>
        ) : (
          <div className="ops-pulse text-xs p-4" style={{ color: 'var(--ops-dim)' }}>ACQUIRING HOST DATA…</div>
        )}
      </OpsPanel>

      {/* Gauges */}
      <OpsPanel
        title="Core Vitals"
        className="col-span-12 lg:col-span-8"
        right={<StatusDot ok={connected} label={connected ? 'LIVE FEED' : 'LINK DOWN'} />}
        bodyClassName="flex items-center justify-around flex-wrap gap-2 p-2"
      >
        <Gauge value={frame?.cpu ?? 0} label="CPU Load" sublabel={frame ? `${frame.cores.length} cores` : undefined} />
        <Gauge value={memPct} label="Memory" sublabel={frame ? `${formatBytes(frame.mem.used)} / ${formatBytes(frame.mem.total)}` : undefined} />
        <Gauge value={swapPct} label="Swap" color={swapPct === 0 ? 'var(--ops-dim)' : undefined} sublabel={frame && frame.mem.swapTotal > 0 ? `${formatBytes(frame.mem.swapUsed)} / ${formatBytes(frame.mem.swapTotal)}` : 'no swap'} />
        <div className="flex flex-col gap-2 min-w-[130px]">
          <div>
            <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: 'var(--ops-dim)' }}>Uptime</div>
            <div className="ops-display text-sm ops-glow-green">{frame ? formatUptime(frame.uptime) : '—'}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: 'var(--ops-dim)' }}>Load Avg</div>
            <div className="ops-display text-sm ops-glow-yellow">{frame ? frame.loadavg.map((l) => l.toFixed(2)).join(' / ') : '—'}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: 'var(--ops-dim)' }}>Processes</div>
            <div className="ops-display text-sm ops-glow-magenta">{frame?.procs ?? '—'}</div>
          </div>
        </div>
      </OpsPanel>

      {/* CPU history */}
      <OpsPanel title="CPU // Timeline" className="col-span-12 lg:col-span-6 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={cpuData} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
            <defs>
              <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#00f0ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={[0, 100]} hide />
            <Tooltip content={<NeonTooltip formatter={(v: number) => `${v.toFixed(1)}%`} />} />
            <Area type="monotone" dataKey="cpu" name="CPU" stroke="#00f0ff" strokeWidth={1.5} fill="url(#cpuGrad)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </OpsPanel>

      {/* Network */}
      <OpsPanel
        title="Network // Throughput"
        accent="magenta"
        className="col-span-12 lg:col-span-6 h-48"
        right={
          <span className="text-[10px]">
            <span className="ops-glow-cyan">▼ {frame ? formatRate(frame.net.rx) : '—'}</span>{' '}
            <span className="ops-glow-magenta">▲ {frame ? formatRate(frame.net.tx) : '—'}</span>
          </span>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={netData} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
            <defs>
              <linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#00f0ff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff2bd6" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#ff2bd6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis hide />
            <Tooltip content={<NeonTooltip formatter={(v: number) => formatRate(v)} />} />
            <Area type="monotone" dataKey="rx" name="RX" stroke="#00f0ff" strokeWidth={1.5} fill="url(#rxGrad)" isAnimationActive={false} />
            <Area type="monotone" dataKey="tx" name="TX" stroke="#ff2bd6" strokeWidth={1.5} fill="url(#txGrad)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </OpsPanel>

      {/* Per-core */}
      <OpsPanel title={`Cores // ${frame?.cores.length ?? 0} Units`} className="col-span-12 lg:col-span-6">
        {frame ? <CoreBars cores={frame.cores} /> : <div className="ops-pulse text-xs p-4" style={{ color: 'var(--ops-dim)' }}>WAITING FOR FEED…</div>}
      </OpsPanel>

      {/* Disk IO */}
      <OpsPanel
        title="Disk // I/O"
        className="col-span-12 lg:col-span-6 h-44"
        right={
          <span className="text-[10px]">
            <span className="ops-glow-green">R {frame ? formatRate(frame.io.read) : '—'}</span>{' '}
            <span className="ops-glow-yellow">W {frame ? formatRate(frame.io.write) : '—'}</span>
          </span>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={ioData} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
            <defs>
              <linearGradient id="readGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#39ff88" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#39ff88" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="writeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fcee0a" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#fcee0a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis hide />
            <Tooltip content={<NeonTooltip formatter={(v: number) => formatRate(v)} />} />
            <Area type="monotone" dataKey="read" name="READ" stroke="#39ff88" strokeWidth={1.5} fill="url(#readGrad)" isAnimationActive={false} />
            <Area type="monotone" dataKey="write" name="WRITE" stroke="#fcee0a" strokeWidth={1.5} fill="url(#writeGrad)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </OpsPanel>

      {/* Storage */}
      <OpsPanel title="Storage // Volumes" className="col-span-12" bodyClassName="p-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {disks.map((d) => {
          const color = d.usePercent > 90 ? 'var(--ops-red)' : d.usePercent > 70 ? 'var(--ops-yellow)' : 'var(--ops-cyan)';
          return (
            <div key={d.filesystem + d.mount} className="border border-cyan-400/10 p-2 relative overflow-hidden ops-sweep">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="truncate ops-glow-cyan">{d.mount}</span>
                <span style={{ color: 'var(--ops-dim)' }}>{d.filesystem}</span>
              </div>
              <div className="h-2 bg-cyan-950/50 border border-cyan-400/10 relative">
                <div
                  className="absolute inset-y-0 left-0 transition-all duration-700"
                  style={{ width: `${d.usePercent}%`, background: color, boxShadow: `0 0 8px ${color}` }}
                />
              </div>
              <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--ops-dim)' }}>
                <span>{formatBytes(d.used)} used</span>
                <span style={{ color }}>{d.usePercent}%</span>
                <span>{formatBytes(d.available)} free</span>
              </div>
            </div>
          );
        })}
        {disks.length === 0 && <div className="text-xs p-2" style={{ color: 'var(--ops-dim)' }}>NO VOLUMES DETECTED</div>}
      </OpsPanel>
    </div>
  );
}
