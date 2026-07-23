import { Router } from 'express';
import { spawn } from 'node-pty';
import { WebSocketServer, WebSocket } from 'ws';

const router = Router();

// Store active terminal sessions
const terminals = new Map<string, any>();

export function setupTerminalWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket) => {
    console.log('Terminal WebSocket client connected');

    const dataDirectory = process.env.DATA_DIRECTORY ?? "/home/app/data";
    
    // Spawn a shell process
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    const ptyProcess = spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: dataDirectory,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      }
    });

    const terminalId = Math.random().toString(36).substring(7);
    terminals.set(terminalId, ptyProcess);

    console.log('Terminal process spawned:', terminalId);

    // Send data from PTY to WebSocket
    ptyProcess.onData((data: string) => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      } catch (error) {
        console.error('Error sending terminal data:', error);
      }
    });

    // Handle terminal exit
    ptyProcess.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
      console.log('Terminal process exited:', exitCode, signal);
      terminals.delete(terminalId);
      ws.close();
    });

    // Receive data from WebSocket and write to PTY
    ws.on('message', (data: Buffer) => {
      try {
        const message = data.toString();
        
        // Check if it's a resize message
        try {
          const parsed = JSON.parse(message);
          if (parsed.type === 'resize') {
            ptyProcess.resize(parsed.cols || 80, parsed.rows || 24);
            return;
          }
        } catch {
          // Not JSON, treat as regular terminal input
        }

        ptyProcess.write(message);
      } catch (error) {
        console.error('Error writing to terminal:', error);
      }
    });

    ws.on('close', () => {
      console.log('Terminal WebSocket client disconnected');
      ptyProcess.kill();
      terminals.delete(terminalId);
    });

    ws.on('error', (error) => {
      console.error('Terminal WebSocket error:', error);
      ptyProcess.kill();
      terminals.delete(terminalId);
    });
  });
}

export default router;
