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

dotenv.config();

const app = express();

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/files', filesRouter);
app.use('/api/chat', chatRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/plugins', pluginsRouter);
app.use('/api/git', gitRouter);
app.use('/api/terminal', terminalRouter);

// Export a function to start the server
export async function startServer(port) {
  try {
    if (process.env.NODE_ENV === 'production') {
      setupStaticServing(app);
    }
    const server = app.listen(port, () => {
      console.log(`API Server running on port ${port}`);
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
