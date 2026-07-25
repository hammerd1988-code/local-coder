import express from 'express';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { setupStaticServing } from './static-serve.js';
import filesRouter from './routes/files.js';
import chatRouter from './routes/chat.js';
import settingsRouter from './routes/settings.js';
import pluginsRouter from './routes/plugins.js';
import gitRouter from './routes/git.js';
import terminalRouter, { setupTerminalWebSocket } from './routes/terminal.js';
import huggingfaceRouter from './routes/huggingface.js';
import { metricsMiddleware, metricsHandler } from './metrics.js';

dotenv.config();

const app = express();

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
export async function startServer(port) {
  try {
    if (process.env.NODE_ENV === 'production') {
      setupStaticServing(app);
    }
    const server = app.listen(port, () => {
      console.log(`API Server running on port ${port}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Health check available at: http://localhost:${port}/api/health`);
      console.log(`Metrics available at: http://localhost:${port}/metrics`);
    });

    // Setup WebSocket server for terminal
    const wss = new WebSocketServer({ 
      server,
      path: '/api/terminal'
    });

    setupTerminalWebSocket(wss);
    console.log('Terminal WebSocket server initialized');

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
