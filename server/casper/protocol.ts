/** Casper CLI ↔ Railway relay protocol (mirrors BSC-V3 shared/protocol.ts). */

export type DirectiveSource = 'mobile' | 'web' | 'cli_repl' | 'routine';

export interface ConversationTurn {
  role: 'user' | 'casper';
  text: string;
}

export interface MachineInfo {
  machineId: string;
  machineName: string;
  os: string;
  arch: string;
  nodeVersion: string;
  cliVersion: string;
  capabilities: string[];
}

export interface ProcessInfo {
  id: string;
  command: string;
  pid: number;
  uptime: number;
  port?: number;
}

export type CliToRelayMessage =
  | { type: 'cli:register'; token: string; machine: MachineInfo }
  | { type: 'cli:heartbeat'; machineId: string; uptime: number; load: number[]; processes: ProcessInfo[] }
  | { type: 'cli:status'; machineId: string; online: boolean; processes: ProcessInfo[] }
  | { type: 'tool:start'; directiveId: string; toolName: string; args: Record<string, unknown> }
  | { type: 'tool:stdout'; directiveId: string; chunk: string }
  | { type: 'tool:result'; directiveId: string; result: { ok: boolean; data: unknown; error?: string; durationMs: number } }
  | { type: 'cli:approval_request'; directiveId: string; machineId: string; toolName: string; args: Record<string, unknown>; reason: string }
  | { type: 'directive:complete'; directiveId: string; status: 'completed' | 'failed'; response: string }
  | { type: 'llm:token'; directiveId: string; token: string }
  | { type: 'file:received'; transferId: string; ok: boolean; fileName?: string; relativePath?: string; size?: number; error?: string };

export type DirectiveMessage = {
  type: 'directive';
  id: string;
  command: string;
  conversationHistory: ConversationTurn[];
  source: DirectiveSource;
  userId: string;
};

export type RelayToCliMessage =
  | DirectiveMessage
  | { type: 'cli:abort'; directiveId: string }
  | { type: 'cli:approval_response'; directiveId: string; approved: boolean; respondedBy: string }
  | { type: 'relay:ack'; machineId: string; sessionId: string }
  | { type: 'file:push'; transferId: string; fileName: string; contentBase64: string; size: number };
