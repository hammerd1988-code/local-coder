import os from 'os';
import { io, type Socket } from 'socket.io-client';
import {
  CASPER_HOME_VERSION,
  ensureMachineIdentity,
  getAccessToken,
  getApprovalLevel,
  getRelayHttpBase,
  getRelayUrl,
} from './config.js';
import type { CliToRelayMessage, DirectiveMessage, MachineInfo, RelayToCliMessage } from './protocol.js';
import { CAPABILITY_NAMES, writeInboxFile } from './tools.js';
import { runCasperToolLoop } from './tool-loop.js';

const HEARTBEAT_MS = 30_000;
const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_UPLOAD = 8 * 1024 * 1024;

export type DaemonStatus = {
  running: boolean;
  connected: boolean;
  sessionId: string | null;
  machineId: string | null;
  machineName: string | null;
  relayUrl: string | null;
  linked: boolean;
  lastError: string | null;
  lastDirectiveAt: number | null;
};

type Listener = (status: DaemonStatus) => void;

class CasperDaemon {
  private socket: Socket | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private pendingApprovals = new Map<string, (approved: boolean) => void>();
  private aborted = new Set<string>();
  private listeners = new Set<Listener>();
  private status: DaemonStatus = {
    running: false,
    connected: false,
    sessionId: null,
    machineId: null,
    machineName: null,
    relayUrl: null,
    linked: false,
    lastError: null,
    lastDirectiveAt: null,
  };

  getStatus(): DaemonStatus {
    return { ...this.status };
  }

  onStatus(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    const snap = this.getStatus();
    for (const fn of this.listeners) fn(snap);
  }

  private set(partial: Partial<DaemonStatus>) {
    this.status = { ...this.status, ...partial };
    this.emit();
  }

  private send(message: CliToRelayMessage) {
    this.socket?.emit('relay:message', message);
  }

  private async machineInfo(): Promise<MachineInfo> {
    const { machineId, machineName } = await ensureMachineIdentity();
    return {
      machineId,
      machineName,
      os: `${os.platform()} ${os.release()}`,
      arch: os.arch(),
      nodeVersion: process.version,
      cliVersion: CASPER_HOME_VERSION,
      capabilities: CAPABILITY_NAMES,
    };
  }

  async start(): Promise<DaemonStatus> {
    if (this.socket) return this.getStatus();

    const token = await getAccessToken();
    const relayRaw = await getRelayUrl();
    const httpBase = getRelayHttpBase(relayRaw);
    const machine = await this.machineInfo();

    this.set({
      running: true,
      linked: !!token,
      machineId: machine.machineId,
      machineName: machine.machineName,
      relayUrl: httpBase,
      lastError: token ? null : 'Not linked — pair this machine from the Casper panel',
    });

    if (!token) {
      this.set({ running: false });
      return this.getStatus();
    }

    const socket = io(`${httpBase}/relay`, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      timeout: 15000,
    });
    this.socket = socket;

    socket.on('connect', () => {
      console.log(`[casper] connected to relay ${httpBase}/relay`);
      this.set({ connected: true, lastError: null });
      this.send({ type: 'cli:register', token, machine });
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.heartbeat = setInterval(() => {
        this.send({
          type: 'cli:heartbeat',
          machineId: machine.machineId,
          uptime: process.uptime(),
          load: os.loadavg(),
          processes: [],
        });
      }, HEARTBEAT_MS);
    });

    socket.on('connect_error', (err) => {
      console.warn('[casper] connect_error', err.message);
      this.set({ connected: false, lastError: err.message });
      if (/invalid|revoked|required/i.test(err.message)) {
        this.stop();
      }
    });

    socket.on('disconnect', (reason) => {
      if (this.heartbeat) {
        clearInterval(this.heartbeat);
        this.heartbeat = null;
      }
      console.warn('[casper] disconnected', reason);
      this.set({ connected: false, sessionId: null, lastError: `Disconnected (${reason})` });
    });

    socket.on('relay:message', (message: RelayToCliMessage) => {
      if (!message || typeof message !== 'object' || typeof (message as any).type !== 'string') return;
      switch (message.type) {
        case 'relay:ack':
          this.set({ sessionId: message.sessionId, connected: true, lastError: null });
          this.send({ type: 'cli:status', machineId: machine.machineId, online: true, processes: [] });
          console.log('[casper] registered session', message.sessionId.slice(0, 8));
          break;
        case 'directive':
          void this.executeDirective(message);
          break;
        case 'cli:abort':
          this.aborted.add(message.directiveId);
          this.pendingApprovals.get(message.directiveId)?.(false);
          break;
        case 'cli:approval_response':
          this.pendingApprovals.get(message.directiveId)?.(message.approved);
          break;
        case 'file:push':
          void this.receiveFile(message);
          break;
      }
    });

    return this.getStatus();
  }

  stop(): DaemonStatus {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.pendingApprovals.clear();
    this.set({
      running: false,
      connected: false,
      sessionId: null,
      lastError: null,
    });
    console.log('[casper] daemon stopped');
    return this.getStatus();
  }

  private async receiveFile(message: { transferId: string; fileName: string; contentBase64: string }) {
    try {
      const buffer = Buffer.from(message.contentBase64, 'base64');
      if (!buffer.length) throw new Error('Empty file');
      if (buffer.length > MAX_UPLOAD) throw new Error('File too large');
      const written = await writeInboxFile(message.fileName, buffer);
      this.send({
        type: 'file:received',
        transferId: message.transferId,
        ok: true,
        fileName: message.fileName,
        relativePath: written.relativePath,
        size: written.size,
      });
    } catch (e) {
      this.send({
        type: 'file:received',
        transferId: message.transferId,
        ok: false,
        fileName: message.fileName,
        error: e instanceof Error ? e.message : 'write failed',
      });
    }
  }

  private async executeDirective(directive: DirectiveMessage) {
    const started = Date.now();
    this.set({ lastDirectiveAt: started });
    console.log(`[casper] directive [${directive.source}]: ${directive.command.slice(0, 120)}`);

    const history = [
      ...directive.conversationHistory.map((t) => ({
        role: t.role === 'casper' ? 'assistant' : 'user',
        content: t.text,
      })),
    ];
    if (history[history.length - 1]?.content !== directive.command) {
      history.push({ role: 'user', content: directive.command });
    }

    const approvalLevel = await getApprovalLevel();
    const machine = await this.machineInfo();

    try {
      const response = await runCasperToolLoop(history, {
        shouldAbort: () => this.aborted.has(directive.id),
        onToken: (token) => this.send({ type: 'llm:token', directiveId: directive.id, token }),
        onToolCall: (name, args) => this.send({ type: 'tool:start', directiveId: directive.id, toolName: name, args }),
        onToolResult: (name, result) => {
          const r = result as { ok?: boolean; error?: string };
          this.send({
            type: 'tool:result',
            directiveId: directive.id,
            result: {
              ok: r?.ok !== false,
              data: result,
              error: r?.ok === false ? r.error : undefined,
              durationMs: Date.now() - started,
            },
          });
        },
        confirm: async (detail) => {
          if (approvalLevel === 'auto') return true;
          this.send({
            type: 'cli:approval_request',
            directiveId: directive.id,
            machineId: machine.machineId,
            toolName: 'local__shell',
            args: { command: detail },
            reason: `Casper wants to run: ${detail}`,
          });
          return new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => {
              this.pendingApprovals.delete(directive.id);
              resolve(false);
            }, APPROVAL_TIMEOUT_MS);
            this.pendingApprovals.set(directive.id, (approved) => {
              clearTimeout(timer);
              this.pendingApprovals.delete(directive.id);
              resolve(approved);
            });
          });
        },
      });

      if (this.aborted.has(directive.id)) {
        this.aborted.delete(directive.id);
        this.send({
          type: 'directive:complete',
          directiveId: directive.id,
          status: 'failed',
          response: 'Directive aborted by operator.',
        });
        return;
      }

      this.send({
        type: 'directive:complete',
        directiveId: directive.id,
        status: 'completed',
        response,
      });
      console.log(`[casper] directive complete (${Date.now() - started}ms)`);
    } catch (e) {
      this.aborted.delete(directive.id);
      const msg = e instanceof Error ? e.message : 'Directive failed';
      this.send({
        type: 'directive:complete',
        directiveId: directive.id,
        status: 'failed',
        response: msg,
      });
      console.error('[casper] directive failed', msg);
    }
  }
}

export const casperDaemon = new CasperDaemon();
