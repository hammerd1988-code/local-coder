import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard, FolderTree, TerminalSquare, Cpu, ServerCog, Network, ScrollText, Code2, Server, Plus, Trash2, X,
} from 'lucide-react';
import { NodeProvider, useNode } from '@/components/ops/NodeContext';
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

const EMPTY_FORM = { name: '', host: '', user: 'root', port: '22', remotePort: '4000', identityFile: '' };

function NodeSwitcher() {
  const { nodes, selectedId, setSelectedId, envRegistry, addNode, removeNode } = useNode();
  const [open, setOpen] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [form, setForm] = React.useState({ ...EMPTY_FORM });
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const selected = nodes.find((n) => n.id === selectedId) ?? nodes[0];
  const statusColor = (s: string) => (s === 'up' ? 'var(--ops-green)' : s === 'connecting' ? 'var(--ops-yellow)' : 'var(--ops-red)');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await addNode({
        name: form.name.trim() || undefined,
        host: form.host.trim(),
        user: form.user.trim() || undefined,
        port: parseInt(form.port, 10) || 22,
        remotePort: parseInt(form.remotePort, 10) || 4000,
        identityFile: form.identityFile.trim() || undefined,
      });
      setForm({ ...EMPTY_FORM });
      setAdding(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Remove node ${name} from the dashboard? (This only detaches it here; the node keeps running.)`)) return;
    try {
      await removeNode(id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const field = (key: keyof typeof EMPTY_FORM, label: string, placeholder: string) => (
    <label className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-[0.18em]" style={{ color: 'var(--ops-dim)' }}>{label}</span>
      <input
        className="ops-input !py-1"
        style={{ clipPath: 'none' }}
        value={form[key]}
        placeholder={placeholder}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </label>
  );

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 px-3 py-1 border ops-sweep relative overflow-hidden"
        style={{ borderColor: 'rgba(0,240,255,0.35)', background: 'rgba(0,240,255,0.05)' }}
        onClick={() => setOpen((v) => !v)}
        title="Switch / manage rack nodes"
      >
        <Server size={13} style={{ color: 'var(--ops-cyan)' }} />
        <span className="ops-display text-xs ops-glow-cyan">{selected?.name ?? 'NODE-01'}</span>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor(selected?.status ?? 'down'), boxShadow: `0 0 6px ${statusColor(selected?.status ?? 'down')}` }} />
        <span className="text-[9px]" style={{ color: 'var(--ops-dim)' }}>▼</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => { setOpen(false); setAdding(false); }} />
          <div className="absolute right-0 mt-1 z-30 w-[300px] ops-panel" style={{ background: 'rgba(4,10,20,0.98)' }}>
            <div className="px-3 py-1.5 flex items-center justify-between text-[9px] uppercase tracking-[0.24em] border-b" style={{ color: 'var(--ops-dim)', borderColor: 'rgba(0,240,255,0.15)' }}>
              <span>Rack Nodes // {nodes.length}</span>
              {!envRegistry && !adding && (
                <button className="ops-btn !px-1.5 !py-0.5" onClick={() => { setAdding(true); setError(''); }} title="Add a node">
                  <Plus size={11} />
                </button>
              )}
            </div>

            {nodes.map((n) => (
              <div key={n.id} className={`ops-nav-item ${n.id === selectedId ? 'active' : ''} !cursor-default`} style={{ textTransform: 'none', letterSpacing: '0.05em' }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusColor(n.status), boxShadow: `0 0 6px ${statusColor(n.status)}` }} />
                <button
                  className="flex-1 text-left ops-display text-xs truncate"
                  onClick={() => { setSelectedId(n.id); setOpen(false); }}
                  title={n.type === 'ssh' ? `${n.user}@${n.host}${n.lastError ? ' — ' + n.lastError : ''}` : 'this machine'}
                >
                  {n.name}
                </button>
                <span className="text-[9px]" style={{ color: 'var(--ops-dim)' }}>
                  {n.type === 'local' ? 'LOCAL' : n.status.toUpperCase()}
                </span>
                {n.type === 'ssh' && !envRegistry && (
                  <button className="shrink-0 hover:text-red-400" style={{ color: 'var(--ops-dim)' }} onClick={() => remove(n.id, n.name)} title="Remove node">
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}

            {error && <div className="px-3 py-1 text-[10px] ops-glow-red">⚠ {error}</div>}
            {envRegistry && (
              <div className="px-3 py-2 text-[9px] leading-relaxed" style={{ color: 'var(--ops-dim)' }}>
                Registry pinned by OPS_NODES env — edit that to change nodes.
              </div>
            )}

            {adding && (
              <form onSubmit={submit} className="p-3 border-t flex flex-col gap-2" style={{ borderColor: 'rgba(0,240,255,0.15)' }}>
                <div className="flex items-center justify-between">
                  <span className="ops-glow-cyan text-[10px] uppercase tracking-[0.2em]">New Node // SSH</span>
                  <button type="button" onClick={() => setAdding(false)}><X size={11} style={{ color: 'var(--ops-dim)' }} /></button>
                </div>
                {field('name', 'Label', 'NODE-02')}
                {field('host', 'Host', '10.0.0.12')}
                <div className="grid grid-cols-2 gap-2">
                  {field('user', 'SSH User', 'ubuntu')}
                  {field('port', 'SSH Port', '22')}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {field('remotePort', 'Node Port', '4000')}
                  {field('identityFile', 'Key Path', '/root/.ssh/id_ed25519')}
                </div>
                <button type="submit" className="ops-btn mt-1" disabled={busy || !form.host.trim()}>
                  {busy ? 'LINKING…' : 'ESTABLISH UPLINK'}
                </button>
                <span className="text-[9px] leading-snug" style={{ color: 'var(--ops-dim)' }}>
                  The hub reaches this node over SSH. Ensure this machine's key is authorized on it (ssh-copy-id).
                </span>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function OpsDeck() {
  const { selectedId } = useNode();
  const [module, setModule] = React.useState<ModuleId>('dashboard');
  const [overview, setOverview] = React.useState<Overview | null>(null);
  const [online, setOnline] = React.useState(false);

  React.useEffect(() => {
    document.title = 'NEO//OPS — Server Control Deck';
    setOverview(null);
    setOnline(false);
    const ping = () =>
      opsGet<Overview>('/api/system/overview')
        .then((o) => { setOverview(o); setOnline(true); })
        .catch(() => setOnline(false));
    ping();
    const t = setInterval(ping, 15_000);
    return () => clearInterval(t);
  }, [selectedId]);

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
          <NodeSwitcher />
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

        {/* Module viewport. Keyed by node so switching nodes remounts every
            module (fresh fetches + new PTY sessions against the new host).
            Console stays mounted across module switches to keep PTYs alive. */}
        <main key={selectedId} className="flex-1 min-w-0 min-h-0">
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

export default function ServerOpsPage() {
  return (
    <NodeProvider>
      <OpsDeck />
    </NodeProvider>
  );
}
