import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Socket } from 'net';
import httpProxy from 'http-proxy';
import { loadNodes, findNode, addRemoteNode, removeRemoteNode, usingEnvRegistry } from '../ops/nodes-config.js';
import { tunnelStatus, syncTunnels, stopTunnel } from '../ops/tunnels.js';
import { getLicenseStatus } from '../license.js';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

// Registry mutations are driven only by the local dashboard (SSH tunnel =
// loopback). Reached over a node proxy or the LAN, they are refused.
function localOnly(req: Request, res: Response, next: NextFunction) {
  if (req.socket?.remoteAddress && LOOPBACK.has(req.socket.remoteAddress)) {
    next();
    return;
  }
  res.status(403).json({ error: 'Forbidden' });
}

// Reverse proxy that lets the hub UI drive a remote node's own NEO//OPS
// instance. The frontend prefixes remote calls with `/nodes/:id`; we strip
// that prefix and forward to the node's SSH tunnel on 127.0.0.1:<localPort>.

const router = Router();

const proxy = httpProxy.createProxyServer({
  ws: true,
  xfwd: false,
  changeOrigin: true,
});

proxy.on('error', (err, _req, res) => {
  const target = res as Response | Socket | undefined;
  if (target && 'writeHead' in target && !(target as Response).headersSent) {
    (target as Response).writeHead(502, { 'Content-Type': 'application/json' });
    (target as Response).end(JSON.stringify({ error: `node link error: ${err.message}` }));
  } else if (target && 'destroy' in target) {
    (target as Socket).destroy();
  }
});

// SSE needs unbuffered streaming
proxy.on('proxyReq', (proxyReq, req) => {
  if (req.url?.includes('/system/stream')) proxyReq.setHeader('X-Accel-Buffering', 'no');
});

// GET /api/nodes — registry + live tunnel status
router.get('/', (_req: Request, res: Response) => {
  const nodes = loadNodes().map((n) => {
    if (n.type === 'local') {
      return { id: n.id, name: n.name, type: n.type, status: 'up' as const };
    }
    const st = tunnelStatus(n.id);
    return {
      id: n.id,
      name: n.name,
      type: n.type,
      host: n.host,
      user: n.user,
      status: st?.state ?? 'down',
      restarts: st?.restarts ?? 0,
      lastError: st?.lastError ?? '',
    };
  });
  res.json({ nodes, envRegistry: usingEnvRegistry() });
});

// POST /api/nodes — add a remote node and bring its tunnel up immediately.
// Remote nodes are a BSC-licensed feature: Operator allows 1, Architect unlimited.
router.post('/', localOnly, async (req: Request, res: Response) => {
  const license = await getLicenseStatus();
  const remoteCount = loadNodes().filter((n) => n.type === 'ssh').length;
  const limit = license.remoteNodeLimit;
  if (limit !== null && remoteCount >= limit) {
    res.status(402).json({
      error: license.linked
        ? `Your ${license.tier} plan allows ${limit} remote node${limit === 1 ? '' : 's'}. Upgrade at bloodsweatcode.org for more.`
        : 'Remote nodes require a Blood Sweat Code license. Link your account in Casper settings (key from bloodsweatcode.org → Subscription).',
      upgradeUrl: 'https://bloodsweatcode.org/settings/subscription',
    });
    return;
  }
  if (usingEnvRegistry()) {
    res.status(409).json({ error: 'Registry is pinned by the OPS_NODES environment variable; edit that instead.' });
    return;
  }
  const { name, host, user, port, remotePort, identityFile } = req.body ?? {};
  if (typeof host !== 'string' || !host.trim()) {
    res.status(400).json({ error: 'host is required (IP or DNS reachable over SSH)' });
    return;
  }
  try {
    const node = addRemoteNode({ name, host, user, port, remotePort, identityFile });
    syncTunnels();
    res.json({ ok: true, node: { id: node.id, name: node.name, host: node.host, user: node.user } });
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? String(err) });
  }
});

// DELETE /api/nodes/:id — remove a remote node and tear its tunnel down.
router.delete('/:id', localOnly, (req: Request, res: Response) => {
  if (usingEnvRegistry()) {
    res.status(409).json({ error: 'Registry is pinned by the OPS_NODES environment variable; edit that instead.' });
    return;
  }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (removeRemoteNode(id)) {
    stopTunnel(id);
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: 'Node not found' });
  }
});

function targetFor(id: string): string | null {
  const node = findNode(id);
  if (!node || node.type !== 'ssh' || !node.localPort) return null;
  return `http://127.0.0.1:${node.localPort}`;
}

// Express handler mounted at /nodes/:id — req.url is already stripped of the
// mount path, so it forwards e.g. /api/system/overview verbatim to the node.
export function proxyNodeHttp(req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const target = targetFor(id);
  if (!target) {
    res.status(404).json({ error: 'Unknown or non-remote node' });
    return;
  }
  proxy.web(req, res, { target });
}

// Raw upgrade handler for `/nodes/:id/api/terminal` WebSocket sessions.
export function proxyNodeWs(id: string, restUrl: string, req: any, socket: Socket, head: Buffer): boolean {
  const target = targetFor(id);
  if (!target) {
    socket.destroy();
    return true;
  }
  req.url = restUrl;
  proxy.ws(req, socket, head, { target });
  return true;
}

export default router;
