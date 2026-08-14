// Shared helpers for the Server Ops GUI

export interface Overview {
  hostname: string;
  distro: string;
  kernel: string;
  arch: string;
  uptime: number;
  bootTime: number;
  loadavg: number[];
  cpu: { model: string; cores: number; speedMHz: number };
  memory: MemInfo;
  addresses: { iface: string; address: string; family: string }[];
  user: string;
}

export interface MemInfo {
  total: number;
  used: number;
  available: number;
  cached: number;
  buffers: number;
  swapTotal: number;
  swapUsed: number;
}

export interface TelemetryFrame {
  t: number;
  cpu: number;
  cores: number[];
  mem: MemInfo;
  net: { rx: number; tx: number };
  io: { read: number; write: number };
  loadavg: number[];
  uptime: number;
  procs?: number;
}

export interface ProcessInfo {
  pid: number;
  ppid: number;
  user: string;
  cpu: number;
  mem: number;
  rss: number;
  stat: string;
  etime: string;
  nice: string;
  command: string;
}

export interface ServiceInfo {
  name: string;
  load: string;
  active: string;
  sub: string;
  description: string;
}

export interface FsEntry {
  name: string;
  type: 'dir' | 'file';
  symlink: boolean;
  linkTarget?: string;
  size: number;
  mode: string;
  mtime: number;
  owner: string;
  group: string;
}

export interface DiskInfo {
  filesystem: string;
  size: number;
  used: number;
  available: number;
  usePercent: number;
  mount: string;
}

// Active node base path. Empty string = the local hub machine; a remote node
// is addressed via the hub's reverse proxy at `/nodes/<id>`. The NodeProvider
// sets this synchronously whenever the operator switches nodes, and modules
// remount on switch, so every subsequent request targets the chosen node.
let activeApiBase = '';

export function setActiveApiBase(base: string): void {
  activeApiBase = base || '';
}

export function getActiveApiBase(): string {
  return activeApiBase;
}

/** Prefix an `/api/...` path with the active node base. */
export function apiUrl(path: string): string {
  return `${activeApiBase}${path}`;
}

export async function opsGet<T>(url: string): Promise<T> {
  const res = await fetch(apiUrl(url));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error ?? `HTTP ${res.status}`);
  return data as T;
}

export async function opsPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(apiUrl(url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error ?? `HTTP ${res.status}`);
  return data as T;
}

export interface NodeSummary {
  id: string;
  name: string;
  type: 'local' | 'ssh';
  status: 'up' | 'connecting' | 'down';
  host?: string;
  user?: string;
  restarts?: number;
  lastError?: string;
}

export function nodeApiBase(node: Pick<NodeSummary, 'id' | 'type'>): string {
  return node.type === 'local' ? '' : `/nodes/${node.id}`;
}

export function formatBytes(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : digits)} ${units[i]}`;
}

export function formatRate(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export function formatTimestamp(ms: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
