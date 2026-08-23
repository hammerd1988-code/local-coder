// Must be first: modules below read process.env at module scope, and ES imports
// are evaluated before this module's body runs.
import 'dotenv/config';
import express from 'express';
import { WebSocketServer } from 'ws';
import { setupStaticServing } from './static-serve.js';
import filesRouter from './routes/files.js';
import chatRouter from './routes/chat.js';
import settingsRouter from './routes/settings.js';
import pluginsRouter from './routes/plugins.js';
import gitRouter from './routes/git.js';
import terminalRouter, { setupTerminalWebSocket } from './routes/terminal.js';
import huggingfaceRouter from './routes/huggingface.js';
import previewRouter from './routes/preview.js';
import workspaceRouter from './routes/workspace.js';
import casperRouter from './routes/casper.js';
import systemRouter from './routes/system.js';
import sysfsRouter from './routes/sysfs.js';
import nodesRouter, { proxyNodeHttp, proxyNodeWs } from './routes/nodes.js';
import { startTunnels, stopTunnels } from './ops/tunnels.js';
import { casperDaemon } from './casper/daemon.js';
import { getAccessToken } from './casper/config.js';
import { metricsMiddleware, metricsHandler } from './metrics.js';
import { getLicenseStatus, invalidateLicenseCache } from './license.js';

const app = express();

const LOCAL_ADDRESSES = new Set([
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1'
]);

function isLocalRequest(ip: string | undefined) {
  return !!ip && LOCAL_ADDRESSES.has(ip);
}

function localOnlyGuard(req: any, res: any, next: any) {
  // Use the socket remote address as the source of truth to avoid
  // proxy-derived `req.ip` values being treated as local.
  if (isLocalRequest(req.socket?.remoteAddress)) {
    next();
    return;
  }

  res.status(403).json({ error: 'Forbidden' });
}

// Single rack dashboard: proxy /nodes/:id/* to the selected node's own
// NEO//OPS instance over its SSH tunnel. Mounted before body parsers so the
// request body streams through untouched (uploads, SSE, etc.).
app.use('/nodes/:id', (req, res) => proxyNodeHttp(req, res));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Metrics middleware (track all requests)
app.use(metricsMiddleware);

// API routes
app.use('/api/files', filesRouter);
app.use('/api/chat', chatRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/plugins', pluginsRouter);
app.use('/api/git', gitRouter);
app.use('/api/terminal', terminalRouter);
app.use('/api/huggingface', huggingfaceRouter);
app.use('/api/preview', previewRouter);
app.use('/api/workspace', localOnlyGuard, workspaceRouter);
// Server Ops GUI: same trust model as the terminal WS (raw shell access) —
// the server binds to localhost by default. Remote nodes are reached only via
// the hub's per-node SSH tunnels (see routes/nodes.ts), never exposed on LAN.
app.use('/api/system', systemRouter);
app.use('/api/sysfs', sysfsRouter);
// Node registry + live SSH-tunnel status for the single rack dashboard.
app.use('/api/nodes', nodesRouter);
app.use('/api/casper', localOnlyGuard, casperRouter);

// BSC license status for the UI (tier + unlocked features; never the key itself).
app.get('/api/license/status', async (_req, res) => {
  res.json(await getLicenseStatus());
});
app.post('/api/license/refresh', localOnlyGuard, async (_req, res) => {
  invalidateLicenseCache();
  res.json(await getLicenseStatus());
});

// Metrics endpoint
app.get('/metrics', metricsHandler);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
  return;
});

// Export a function to start the server
export async function startServer(port: number | string) {
  try {
    if (process.env.NODE_ENV === 'production') {
      setupStaticServing(app);
    }
    const host = process.env.HOST || '127.0.0.1';
    const listenPort = typeof port === 'string' ? parseInt(port, 10) : port;
    const server = app.listen(listenPort, host, () => {
      console.log(`API Server running on port ${port}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Health check available at: http://localhost:${port}/api/health`);
      console.log(`Metrics available at: http://localhost:${port}/metrics`);
    });

    // Setup WebSocket server for terminal. Use `noServer` so we route upgrades
    // ourselves: `/nodes/:id/...` upgrades are proxied to a remote node over
    // its SSH tunnel; `/api/terminal` is served by the local PTY.
    const wss = new WebSocketServer({ noServer: true });
    setupTerminalWebSocket(wss);

    server.on('upgrade', (req, socket, head) => {
      const url = req.url || '';
      const nodeMatch = /^\/nodes\/([^/]+)(\/.*)$/.exec(url);
      if (nodeMatch) {
        proxyNodeWs(nodeMatch[1], nodeMatch[2], req, socket as any, head);
        return;
      }
      if (url.split('?')[0] === '/api/terminal') {
        wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
        return;
      }
      socket.destroy();
    });
    console.log('Terminal WebSocket server initialized');

    // Bring up SSH tunnels to any configured remote nodes.
    startTunnels();
    const shutdownTunnels = () => stopTunnels();
    process.once('SIGTERM', shutdownTunnels);
    process.once('SIGINT', shutdownTunnels);
    process.once('exit', shutdownTunnels);

    // Reconnect Casper to the relay on boot if this machine is already paired,
    // so remote (phone/web) directives keep working across restarts.
    getAccessToken()
      .then((token) => {
        if (!token) return;
        console.log('[casper] machine is linked — auto-starting daemon');
        return casperDaemon.start();
      })
      .catch((err) => console.warn('[casper] daemon auto-start failed:', err instanceof Error ? err.message : err));

    return server;
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Start the server directly if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Starting server...');
  startServer(process.env.PORT || 3001);
}
