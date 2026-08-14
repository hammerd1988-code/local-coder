import * as fs from 'fs';
import * as path from 'path';

// Node registry for the "single rack dashboard". One hub instance fronts the
// local machine plus any number of remote nodes reached over SSH tunnels.

export interface RemoteNodeConfig {
  id: string;
  name: string;
  type: 'local' | 'ssh';
  // ssh-only fields
  host?: string;
  user?: string;
  port?: number; // ssh port, default 22
  remotePort?: number; // port the node's own NEO//OPS instance listens on, default 4000
  identityFile?: string; // optional private key path
  // assigned by the hub at load time
  localPort?: number; // local tunnel port the hub binds for this node
}

const DATA_DIR = process.env.DATA_DIRECTORY ?? '/home/app/data';
const TUNNEL_PORT_BASE = 4100;

function slug(name: string, index: number): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || `node${index}`;
}

function normalize(raw: any[], localName: string): RemoteNodeConfig[] {
  const nodes: RemoteNodeConfig[] = [
    { id: 'local', name: localName, type: 'local' },
  ];
  let tunnelIndex = 0;
  raw.forEach((entry, i) => {
    if (!entry || typeof entry !== 'object') return;
    if (entry.type === 'local') return; // local is implicit
    const name = String(entry.name ?? `NODE-${String(i + 2).padStart(2, '0')}`);
    const id = String(entry.id ?? slug(name, i + 2));
    if (id === 'local' || nodes.some((n) => n.id === id)) return;
    if (!entry.host) return; // ssh node without a host is unusable
    nodes.push({
      id,
      name,
      type: 'ssh',
      host: String(entry.host),
      user: entry.user ? String(entry.user) : 'root',
      port: entry.port ? Number(entry.port) : 22,
      remotePort: entry.remotePort ? Number(entry.remotePort) : 4000,
      identityFile: entry.identityFile ? String(entry.identityFile) : undefined,
      localPort: TUNNEL_PORT_BASE + tunnelIndex++,
    });
  });
  return nodes;
}

let cached: RemoteNodeConfig[] | null = null;

export function loadNodes(): RemoteNodeConfig[] {
  if (cached) return cached;
  const localName = process.env.OPS_NODE_NAME || 'NODE-01';
  let raw: any[] = [];

  // 1. Inline JSON via env (handy for containers / systemd drop-ins)
  if (process.env.OPS_NODES) {
    try {
      const parsed = JSON.parse(process.env.OPS_NODES);
      if (Array.isArray(parsed)) raw = parsed;
      else if (Array.isArray(parsed?.nodes)) raw = parsed.nodes;
    } catch (err) {
      console.warn('[ops] OPS_NODES is not valid JSON, ignoring:', err instanceof Error ? err.message : err);
    }
  }

  // 2. nodes.json in the data directory
  if (raw.length === 0) {
    const file = path.join(DATA_DIR, 'nodes.json');
    try {
      if (fs.existsSync(file)) {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (Array.isArray(parsed)) raw = parsed;
        else if (Array.isArray(parsed?.nodes)) raw = parsed.nodes;
      }
    } catch (err) {
      console.warn('[ops] failed to read nodes.json:', err instanceof Error ? err.message : err);
    }
  }

  cached = normalize(raw, localName);
  const remotes = cached.filter((n) => n.type === 'ssh');
  if (remotes.length > 0) {
    console.log(`[ops] hub mode: ${remotes.length} remote node(s) — ${remotes.map((n) => `${n.name}(${n.user}@${n.host}:${n.port}→127.0.0.1:${n.localPort})`).join(', ')}`);
  }
  return cached;
}

export function getRemoteNodes(): RemoteNodeConfig[] {
  return loadNodes().filter((n) => n.type === 'ssh');
}

export function findNode(id: string): RemoteNodeConfig | undefined {
  return loadNodes().find((n) => n.id === id);
}

// ---------------------------------------------------------------------------
// Runtime registry mutation — lets operators add/remove nodes from the UI
// without hand-editing files. Persists to nodes.json in the data directory.
// (If OPS_NODES is set, that env wins on next load; the UI surfaces a warning.)
// ---------------------------------------------------------------------------

export function usingEnvRegistry(): boolean {
  return !!process.env.OPS_NODES;
}

function nodesFilePath(): string {
  return path.join(DATA_DIR, 'nodes.json');
}

function readRawFile(): any[] {
  try {
    if (!fs.existsSync(nodesFilePath())) return [];
    const parsed = JSON.parse(fs.readFileSync(nodesFilePath(), 'utf8'));
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.nodes)) return parsed.nodes;
  } catch (err) {
    console.warn('[ops] failed to read nodes.json for mutation:', err instanceof Error ? err.message : err);
  }
  return [];
}

function writeRawFile(raw: any[]): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(nodesFilePath(), JSON.stringify({ nodes: raw }, null, 2));
  cached = null; // force re-normalize (reassigns tunnel ports deterministically)
}

export interface AddNodeInput {
  name?: string;
  host: string;
  user?: string;
  port?: number;
  remotePort?: number;
  identityFile?: string;
}

export function addRemoteNode(input: AddNodeInput): RemoteNodeConfig {
  const host = String(input.host ?? '').trim();
  if (!host) throw new Error('host is required');

  const raw = readRawFile();
  const existingIds = new Set<string>(['local']);
  raw.forEach((e, i) => existingIds.add(String(e?.id ?? slug(String(e?.name ?? ''), i + 2))));

  const baseName = String(input.name ?? '').trim() || host;
  let id = slug(baseName, raw.length + 2);
  let n = 1;
  while (existingIds.has(id)) id = `${slug(baseName, raw.length + 2)}-${++n}`;

  const entry: Record<string, unknown> = {
    id,
    name: baseName,
    host,
    user: input.user?.trim() || 'root',
    port: Number(input.port) || 22,
    remotePort: Number(input.remotePort) || 4000,
  };
  if (input.identityFile?.trim()) entry.identityFile = input.identityFile.trim();

  raw.push(entry);
  writeRawFile(raw);

  const added = loadNodes().find((node) => node.id === id);
  if (!added) throw new Error('Node was added but could not be resolved');
  return added;
}

export function removeRemoteNode(id: string): boolean {
  if (id === 'local') return false;
  const raw = readRawFile();
  const next = raw.filter((e, i) => String(e?.id ?? slug(String(e?.name ?? ''), i + 2)) !== id);
  if (next.length === raw.length) return false;
  writeRawFile(next);
  return true;
}
