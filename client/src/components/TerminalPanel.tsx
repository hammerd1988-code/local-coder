import * as React from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

export default function TerminalPanel() {
  const terminalRef = React.useRef<HTMLDivElement>(null);
  const xtermRef = React.useRef<Terminal | null>(null);
  const fitAddonRef = React.useRef<FitAddon | null>(null);
  const socketRef = React.useRef<WebSocket | null>(null);

  React.useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
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

    // Connect to websocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/terminal`);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('Terminal WebSocket connected');
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
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    ws.onerror = (error) => {
      console.error('Terminal WebSocket error:', error);
      term.writeln('\r\n\x1b[1;31mWebSocket connection error\x1b[0m\r\n');
    };

    ws.onclose = () => {
      console.log('Terminal WebSocket disconnected');
      term.writeln('\r\n\x1b[1;33mConnection closed. Refresh to reconnect.\x1b[0m\r\n');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        if (ws.readyState === WebSocket.OPEN && xtermRef.current) {
          ws.send(JSON.stringify({
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
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      ws.close();
      term.dispose();
    };
  }, []);

  return (
    <div className="h-full flex flex-col bg-black/80 backdrop-blur-sm border-l border-cyan-500/30">
      <div className="h-10 border-b border-cyan-500/30 flex items-center px-4 bg-gradient-to-r from-purple-900/30 to-cyan-900/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 shadow-lg shadow-red-500/50 animate-pulse"></div>
          <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50"></div>
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-lg shadow-green-500/50"></div>
          <span className="ml-2 text-xs font-mono text-cyan-400">$ TERMINAL</span>
        </div>
      </div>
      <div ref={terminalRef} className="flex-1 p-2 overflow-hidden"></div>
    </div>
  );
}
