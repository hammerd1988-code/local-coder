import * as React from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface TerminalProps {
  terminalId: string;
  isActive: boolean;
}

export default function Terminal({ terminalId, isActive }: TerminalProps) {
  const terminalRef = React.useRef<HTMLDivElement>(null);
  const xtermRef = React.useRef<XTerm | null>(null);
  const fitAddonRef = React.useRef<FitAddon | null>(null);
  const socketRef = React.useRef<WebSocket | null>(null);

  React.useEffect(() => {
    if (!terminalRef.current) return;
    let disposed = false;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
      theme: {
        background: '#0a0a0f',
        foreground: '#00ffff',
        cursor: '#ff00ff',
        black: '#000000',
        red: '#ff0055',
        green: '#00ff88',
        yellow: '#ffaa00',
        blue: '#0088ff',
        magenta: '#ff00ff',
        cyan: '#00ffff',
        white: '#ffffff',
        brightBlack: '#555555',
        brightRed: '#ff5588',
        brightGreen: '#88ffaa',
        brightYellow: '#ffcc55',
        brightBlue: '#5599ff',
        brightMagenta: '#ff55ff',
        brightCyan: '#55ffff',
        brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Connect to websocket (the server requires a per-boot auth token)
    connect();

    async function connect() {
      let token = '';
      try {
        const res = await fetch('/api/terminal/token');
        token = (await res.json()).token;
      } catch (error) {
        console.error('Error fetching terminal token:', error);
        term.writeln('\\r\\n\\x1b[1;31mFailed to authenticate terminal session\\x1b[0m\\r\\n');
        return;
      }
      if (disposed) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/terminal?id=${terminalId}&token=${token}`);
      socketRef.current = ws;
      wireSocket(ws);
    }

    function wireSocket(ws: WebSocket) {
      ws.onopen = () => {
      console.log(`Terminal ${terminalId} WebSocket connected`);
      term.writeln('\\x1b[1;36m╔═══════════════════════════════════════════════════════════╗\\x1b[0m');
      term.writeln('\\x1b[1;36m║   LOCAL.CODE Terminal v2.0.0                             ║\\x1b[0m');
      term.writeln('\\x1b[1;36m║   Enhanced with command aliases & real-time feedback    ║\\x1b[0m');
      term.writeln('\\x1b[1;36m╚═══════════════════════════════════════════════════════════╝\\x1b[0m');
      term.writeln('');
      term.writeln('\\x1b[1;33m✨ Quick Aliases Available:\\x1b[0m');
      term.writeln('  \\x1b[36mll\\x1b[0m = ls -lah  │  \\x1b[36m..\\x1b[0m = cd ..  │  \\x1b[36mcls\\x1b[0m = clear');
      term.writeln('  \\x1b[35mg\\x1b[0m = git  │  \\x1b[35mgs\\x1b[0m = git status  │  \\x1b[35mgl\\x1b[0m = git log');
      term.writeln('  \\x1b[32mn\\x1b[0m = npm  │  \\x1b[32mni\\x1b[0m = npm install  │  \\x1b[32mnr\\x1b[0m = npm run');
      term.writeln('');
      term.writeln('\\x1b[1;33m⌨️  Keyboard Shortcuts:\\x1b[0m');
      term.writeln('  \\x1b[36mCtrl+T\\x1b[0m = New Tab  │  \\x1b[36mCtrl+W\\x1b[0m = Close Tab');
      term.writeln('  \\x1b[36mCtrl+Tab\\x1b[0m = Next Tab  │  \\x1b[36mCtrl+Shift+Tab\\x1b[0m = Prev Tab');
      term.writeln('');
      };

      ws.onmessage = (event) => {
        term.write(event.data);
      };

      ws.onerror = (error) => {
        console.error(`Terminal ${terminalId} WebSocket error:`, error);
        term.writeln('\\r\\n\\x1b[1;31mWebSocket connection error\\x1b[0m\\r\\n');
      };

      ws.onclose = () => {
        console.log(`Terminal ${terminalId} WebSocket disconnected`);
        term.writeln('\\r\\n\\x1b[1;33mConnection closed. Refresh to reconnect.\\x1b[0m\\r\\n');
      };

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });
    }

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current && isActive) {
        fitAddonRef.current.fit();
        const sock = socketRef.current;
        if (sock && sock.readyState === WebSocket.OPEN && xtermRef.current) {
          sock.send(JSON.stringify({
            type: 'resize',
            cols: xtermRef.current.cols,
            rows: xtermRef.current.rows
          }));
        }
      }
    };

    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      disposed = true;
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      socketRef.current?.close();
      term.dispose();
    };
  }, [terminalId]);

  // Refit when becoming active
  React.useEffect(() => {
    if (isActive && fitAddonRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
      }, 100);
    }
  }, [isActive]);

  return (
    <div 
      ref={terminalRef} 
      className={`h-full p-2 overflow-hidden ${isActive ? 'block' : 'hidden'}`}
    />
  );
}
