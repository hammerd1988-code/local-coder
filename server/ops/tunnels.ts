import { spawn, ChildProcess } from 'child_process';
import * as http from 'http';
import { getRemoteNodes, type RemoteNodeConfig } from './nodes-config.js';

// Maintains one `ssh -L` tunnel per remote node so the hub can reach each
// node's localhost-bound NEO//OPS instance without exposing anything on the
// LAN. SSH provides auth + encryption; tunnels auto-restart with backoff and
// end-to-end reachability is confirmed by polling /api/health through them.

export type TunnelState = 'connecting' | 'up' | 'down';

interface Tunnel {
  node: RemoteNodeConfig;
  proc: ChildProcess | null;
  state: TunnelState;
  lastError: string;
  restarts: number;
  backoff: number;
  healthTimer: ReturnType<typeof setInterval> | null;
  stopped: boolean;
}

const tunnels = new Map<string, Tunnel>();

function sshArgs(node: RemoteNodeConfig): string[] {
  const args = [
    '-N',
    '-o', 'BatchMode=yes',
    '-o', 'ExitOnForwardFailure=yes',
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=3',
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', 'ConnectTimeout=10',
    '-p', String(node.port ?? 22),
    '-L', `127.0.0.1:${node.localPort}:127.0.0.1:${node.remotePort ?? 4000}`,
  ];
  if (node.identityFile) args.push('-i', node.identityFile, '-o', 'IdentitiesOnly=yes');
  args.push(`${node.user ?? 'root'}@${node.host}`);
  return args;
}

function pollHealth(t: Tunnel) {
  const req = http.get(
    { host: '127.0.0.1', port: t.node.localPort, path: '/api/health', timeout: 4000 },
    (res) => {
      res.resume();
      if (res.statusCode === 200) {
        if (t.state !== 'up') console.log(`[ops] tunnel ${t.node.name}: UP`);
        t.state = 'up';
        t.backoff = 1000;
      }
    },
  );
  req.on('timeout', () => req.destroy());
  req.on('error', () => {
    // ssh process alive but upstream not answering yet
    if (t.state === 'up') t.state = 'connecting';
  });
}

function launch(t: Tunnel) {
  if (t.stopped) return;
  t.state = 'connecting';
  const proc = spawn('ssh', sshArgs(t.node), { stdio: ['ignore', 'ignore', 'pipe'] });
  t.proc = proc;

  proc.stderr?.on('data', (buf) => {
    const msg = buf.toString().trim();
    if (msg) t.lastError = msg.split('\n').slice(-1)[0];
  });

  proc.on('exit', (code) => {
    t.proc = null;
    t.state = 'down';
    if (t.stopped) return;
    t.restarts += 1;
    t.backoff = Math.min(t.backoff * 2, 30_000);
    console.warn(`[ops] tunnel ${t.node.name} exited (code ${code}); retrying in ${t.backoff}ms. ${t.lastError ? 'Last error: ' + t.lastError : ''}`);
    setTimeout(() => launch(t), t.backoff);
  });

  if (!t.healthTimer) {
    t.healthTimer = setInterval(() => pollHealth(t), 5000);
    setTimeout(() => pollHealth(t), 1500);
  }
}

export function startTunnels() {
  const remotes = getRemoteNodes();
  for (const node of remotes) {
    if (tunnels.has(node.id)) continue;
    const t: Tunnel = {
      node,
      proc: null,
      state: 'connecting',
      lastError: '',
      restarts: 0,
      backoff: 1000,
      healthTimer: null,
      stopped: false,
    };
    tunnels.set(node.id, t);
    launch(t);
  }
}

export function stopTunnels() {
  for (const t of tunnels.values()) {
    t.stopped = true;
    if (t.healthTimer) clearInterval(t.healthTimer);
    t.proc?.kill('SIGTERM');
  }
  tunnels.clear();
}

// Launch tunnels for any newly added nodes (idempotent for existing ones).
export function syncTunnels() {
  startTunnels();
}

export function stopTunnel(id: string) {
  const t = tunnels.get(id);
  if (!t) return;
  t.stopped = true;
  if (t.healthTimer) clearInterval(t.healthTimer);
  t.proc?.kill('SIGTERM');
  tunnels.delete(id);
}

export interface NodeStatus {
  state: TunnelState;
  restarts: number;
  lastError: string;
}

export function tunnelStatus(id: string): NodeStatus | null {
  const t = tunnels.get(id);
  if (!t) return null;
  return { state: t.state, restarts: t.restarts, lastError: t.lastError };
}
