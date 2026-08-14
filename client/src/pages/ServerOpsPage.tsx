import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard, FolderTree, TerminalSquare, Cpu, ServerCog, Network, ScrollText, Code2,
} from 'lucide-react';
import { OpsDashboard } from '@/components/ops/OpsDashboard';
import { OpsFiles } from '@/components/ops/OpsFiles';
import { OpsTerminal } from '@/components/ops/OpsTerminal';
import { OpsProcesses } from '@/components/ops/OpsProcesses';
import { OpsServices } from '@/components/ops/OpsServices';
import { OpsNetwork } from '@/components/ops/OpsNetwork';
import { OpsLogs } from '@/components/ops/OpsLogs';
import { StatusDot } from '@/components/ops/OpsPanel';
import { opsGet, formatUptime, type Overview } from '@/lib/ops';

type ModuleId = 'dashboard' | 'files' | 'terminal' | 'processes' | 'services' | 'network' | 'logs';

const MODULES: { id: ModuleId; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'dashboard', label: 'Overwatch', icon: LayoutDashboard },
  { id: 'files', label: 'Filesystem', icon: FolderTree },
  { id: 'terminal', label: 'Console', icon: TerminalSquare },
  { id: 'processes', label: 'Processes', icon: Cpu },
  { id: 'services', label: 'Daemons', icon: ServerCog },
  { id: 'network', label: 'Network', icon: Network },
  { id: 'logs', label: 'Logs', icon: ScrollText },
];

function Clock() {
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-right leading-tight">
      <div className="ops-display text-sm ops-glow-cyan">{now.toLocaleTimeString(undefined, { hour12: false })}</div>
      <div className="text-[9px] uppercase tracking-[0.2em]" style={{ color: 'var(--ops-dim)' }}>
        {now.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })}
      </div>
    </div>
  );
}

export default function ServerOpsPage() {
  const [module, setModule] = React.useState<ModuleId>('dashboard');
  const [overview, setOverview] = React.useState<Overview | null>(null);
  const [online, setOnline] = React.useState(false);

  React.useEffect(() => {
    document.title = 'NEO//OPS — Server Control Deck';
    const ping = () =>
      opsGet<Overview>('/api/system/overview')
        .then((o) => { setOverview(o); setOnline(true); })
        .catch(() => setOnline(false));
    ping();
    const t = setInterval(ping, 15_000);
    return () => clearInterval(t);
  }, []);

  // Keyboard shortcuts: Alt+1..7 switch modules
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < MODULES.length) {
        e.preventDefault();
        setModule(MODULES[idx].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="ops-root h-screen flex flex-col overflow-hidden">
      <div className="ops-backdrop" />
      <div className="ops-scanlines" />
      <div className="ops-vignette" />

      {/* Header */}
      <header
        className="relative z-10 flex items-center gap-6 px-4 py-2 border-b shrink-0"
        style={{ borderColor: 'rgba(0,240,255,0.18)', background: 'rgba(4,8,16,0.85)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 flex items-center justify-center border ops-flicker"
            style={{ borderColor: 'var(--ops-cyan)', boxShadow: '0 0 12px rgba(0,240,255,0.4), inset 0 0 8px rgba(0,240,255,0.15)' }}
          >
            <span className="ops-display ops-glow-cyan text-xs font-bold">◢◤</span>
          </div>
          <div className="leading-tight">
            <h1 className="ops-display text-base font-bold">
              <span className="ops-glitch ops-glow-cyan" data-text="NEO//OPS">NEO//OPS</span>
            </h1>
            <div className="text-[9px] uppercase tracking-[0.3em]" style={{ color: 'var(--ops-dim)' }}>
              Server Control Deck
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center gap-8">
          <div className="hidden md:block text-center leading-tight">
            <div className="text-[9px] uppercase tracking-[0.2em]" style={{ color: 'var(--ops-dim)' }}>Host</div>
            <div className="ops-display text-xs ops-glow-magenta">{overview?.hostname ?? '—'}</div>
          </div>
          <div className="hidden lg:block text-center leading-tight">
            <div className="text-[9px] uppercase tracking-[0.2em]" style={{ color: 'var(--ops-dim)' }}>System</div>
            <div className="text-xs" style={{ color: '#d7f6ff' }}>{overview?.distro ?? '—'}</div>
          </div>
          <div className="hidden lg:block text-center leading-tight">
            <div className="text-[9px] uppercase tracking-[0.2em]" style={{ color: 'var(--ops-dim)' }}>Uptime</div>
            <div className="ops-display text-xs ops-glow-green">{overview ? formatUptime(overview.uptime) : '—'}</div>
          </div>
          <StatusDot ok={online} label={online ? 'SYSTEM LINK' : 'LINK LOST'} />
        </div>

        <div className="flex items-center gap-4">
          <Link to="/" className="ops-btn !py-1" title="Open code editor">
            <Code2 size={11} className="inline mr-1" />Editor
          </Link>
          <Clock />
        </div>
      </header>

      {/* Body */}
      <div className="relative z-10 flex flex-1 min-h-0">
        {/* Nav rail */}
        <nav
          className="w-44 shrink-0 border-r flex flex-col py-2"
          style={{ borderColor: 'rgba(0,240,255,0.14)', background: 'rgba(4,8,16,0.7)' }}
        >
          {MODULES.map((m, i) => {
            const Icon = m.icon;
            return (
              <button key={m.id} className={`ops-nav-item ${module === m.id ? 'active' : ''}`} onClick={() => setModule(m.id)}>
                <Icon size={14} className="ops-nav-icon" />
                <span className="flex-1 text-left">{m.label}</span>
                <span className="text-[8px] opacity-50">⌥{i + 1}</span>
              </button>
            );
          })}
          <div className="flex-1" />
          <div className="px-4 py-2 text-[8px] leading-relaxed uppercase tracking-[0.2em]" style={{ color: 'var(--ops-dim)' }}>
            <div className="ops-pulse">▚▚▚▚▚▚▚▚</div>
            <div className="mt-1">
              Operator: <span className="ops-glow-cyan">{overview?.user ?? '?'}</span>
            </div>
            <div>Kernel {overview?.kernel ?? '—'}</div>
          </div>
        </nav>

        {/* Module viewport — Console stays mounted to keep PTY sessions alive */}
        <main className="flex-1 min-w-0 min-h-0">
          {module === 'dashboard' && <OpsDashboard />}
          {module === 'files' && <OpsFiles />}
          <div className={module === 'terminal' ? 'h-full' : 'hidden'}>
            <OpsTerminal />
          </div>
          {module === 'processes' && <OpsProcesses />}
          {module === 'services' && <OpsServices />}
          {module === 'network' && <OpsNetwork />}
          {module === 'logs' && <OpsLogs />}
        </main>
      </div>
    </div>
  );
}
