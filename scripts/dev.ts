import { startServer } from '../server/index.js';
import { createServer } from 'vite';

let viteServer;

async function startDev() {
  // Start the Express API server first
  await startServer(3001);

  // Then start Vite in dev mode
  viteServer = await createServer({
    configFile: './vite.config.js',
  });

  await viteServer.listen();
  console.log(
    `Vite dev server running on port ${viteServer.config.server.port}`,
  );
}

/**
 * Handle tsx watch restarts
 * This ensures Vite is closed gracefully before the process exits
 */
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing servers gracefully...');

  if (viteServer) {
    try {
      await viteServer.close();
      console.log('Vite server closed successfully');
    } catch (err) {
      console.error('Error closing Vite server:', err);
    }
  }

  // Exit cleanly so tsx can restart the process
  process.exit(0);
});

startDev();
