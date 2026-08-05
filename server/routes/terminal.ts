import { Router } from 'express';
import { randomBytes } from 'crypto';
import { spawn } from 'node-pty';
import { WebSocketServer, WebSocket } from 'ws';
import { terminalSessionsActive, terminalSessionsTotal, terminalDataTransferred, websocketConnectionsActive, websocketMessagesTotal } from '../metrics.js';

const router = Router();

// Per-boot secret: the terminal WebSocket hands out a raw shell, so require
// clients to first fetch this token over HTTP and echo it on connect.
const sessionToken = randomBytes(32).toString('hex');

router.get('/token', (_req, res) => {
  res.json({ token: sessionToken });
});

// Store active terminal sessions
const terminals = new Map<string, any>();

export function setupTerminalWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, req) => {
    // Extract terminal ID from query string
    const url = new URL(req.url || '', `http://${req.headers.host}`);

    if (url.searchParams.get('token') !== sessionToken) {
      console.warn('Terminal WebSocket rejected: bad or missing token');
      ws.close(1008, 'Unauthorized');
      return;
    }

    const terminalIdFromQuery = url.searchParams.get('id') || Math.random().toString(36).substring(7);
    
    console.log('Terminal WebSocket client connected:', terminalIdFromQuery);
    websocketConnectionsActive.labels('terminal').inc();
    terminalSessionsTotal.labels('created').inc();

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
        PS1: '\\[\\033[1;36m\\]λ\\[\\033[0m\\] \\[\\033[1;35m\\]\\w\\[\\033[0m\\] \\[\\033[1;32m\\]→\\[\\033[0m\\] ',
      }
    });

    // Setup command aliases for the shell
    const aliases = [
      'alias ll="ls -lah --color=auto"',
      'alias la="ls -A --color=auto"', 
      'alias l="ls -CF --color=auto"',
      'alias ..="cd .."',
      'alias ...="cd ../.."',
      'alias cls="clear"',
      'alias h="history"',
      'alias g="git"',
      'alias gs="git status"',
      'alias ga="git add"',
      'alias gc="git commit"',
      'alias gp="git push"',
      'alias gl="git log --oneline --graph --all"',
      'alias gd="git diff"',
      'alias n="npm"',
      'alias ni="npm install"',
      'alias nr="npm run"',
      'alias ns="npm start"',
      'alias nt="npm test"',
      'alias c="cat"',
      'alias v="vim"',
      'alias e="echo"',
      'alias k="kill"',
      'alias p="ps aux | grep"',
      'alias m="mkdir -p"',
      'alias x="chmod +x"',
    ];

    // Send aliases to the shell
    if (shell === 'bash') {
      aliases.forEach(alias => {
        ptyProcess.write(`${alias}\r`);
      });
    }

    terminals.set(terminalIdFromQuery, ptyProcess);
    terminalSessionsActive.set(terminals.size);

    console.log('Terminal process spawned:', terminalIdFromQuery);

    // Send data from PTY to WebSocket
    ptyProcess.onData((data: string) => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
          terminalDataTransferred.labels('outbound').inc(Buffer.byteLength(data));
          websocketMessagesTotal.labels('terminal', 'sent').inc();
        }
      } catch (error) {
        console.error('Error sending terminal data:', error);
      }
    });

    // Handle terminal exit
    ptyProcess.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
      console.log('Terminal process exited:', terminalIdFromQuery, exitCode, signal);
      terminals.delete(terminalIdFromQuery);
      terminalSessionsActive.set(terminals.size);
      terminalSessionsTotal.labels('exited').inc();
      ws.close();
    });

    // Receive data from WebSocket and write to PTY
    ws.on('message', (data: Buffer) => {
      try {
        const message = data.toString();
        websocketMessagesTotal.labels('terminal', 'received').inc();
        
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

        // Echo command feedback for better UX
        const trimmedMessage = message.trim();
        if (trimmedMessage && !trimmedMessage.startsWith('\x1b')) {
          console.log('Terminal command:', trimmedMessage);
        }

        ptyProcess.write(message);
        terminalDataTransferred.labels('inbound').inc(Buffer.byteLength(message));
      } catch (error) {
        console.error('Error writing to terminal:', error);
      }
    });

    ws.on('close', () => {
      console.log('Terminal WebSocket client disconnected:', terminalIdFromQuery);
      ptyProcess.kill();
      terminals.delete(terminalIdFromQuery);
      terminalSessionsActive.set(terminals.size);
      websocketConnectionsActive.labels('terminal').dec();
      terminalSessionsTotal.labels('closed').inc();
    });

    ws.on('error', (error) => {
      console.error('Terminal WebSocket error:', terminalIdFromQuery, error);
      ptyProcess.kill();
      terminals.delete(terminalIdFromQuery);
      terminalSessionsActive.set(terminals.size);
      websocketConnectionsActive.labels('terminal').dec();
      terminalSessionsTotal.labels('error').inc();
    });
  });
}

export default router;
