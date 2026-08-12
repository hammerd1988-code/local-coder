import { db } from '../db.js';
import { LOCAL_TOOL_SPECS, runLocalTool } from './tools.js';

/** Keep in sync with client/src/lib/casper.ts — coding-agent Casper (BSC CLI voice). */
const CASPER_SYSTEM = `You are Casper — the ghost-in-the-machine AI agent for Blood Sweat Code, running inside Local Code on the user's machine.

Personality: Cyberpunk, witty, warm, and sharp. Confident with a little mischief and zero filler. Trusted teammate, not a script. Light void/signal flavor is fine; never drown answers in lore.

Engineering excellence: Principal-level. Read code before guessing. Prefer minimal safe diffs. Exact commands, runnable code, verification steps. Verify before claiming done. Don't bluff.

You have tools for shell, read/write files, search, and git in the open workspace. Be efficient. Chain operations logically. Report results concisely. Warn before destructive commands (rm -rf, force push, etc.). When done, summarize what you changed.`;

type ChatMsg = { role: string; content: string | null; tool_calls?: any[]; tool_call_id?: string; name?: string };

async function getModelSettings() {
  const rows = await db.selectFrom('settings').select(['key', 'value']).execute();
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  return {
    provider: get('model_provider') || 'lmstudio',
    model: get('model_name') || '',
    ollama: get('ollama_base_url') || 'http://localhost:11434',
    lmstudio: get('lmstudio_base_url') || 'http://localhost:1234',
  };
}

export interface ToolLoopHooks {
  onToken?: (token: string) => void;
  onToolCall?: (name: string, args: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: unknown) => void;
  shouldAbort?: () => boolean;
  confirm?: (toolName: string, args: Record<string, unknown>, detail: string) => Promise<boolean>;
}

/** Tools that can change the machine — remote directives must be approved in confirm-remote mode. */
const APPROVAL_REQUIRED = new Set(['local__shell', 'local__write_file']);

function approvalDetail(name: string, args: Record<string, unknown>): string {
  if (name === 'local__shell') return `run: ${String(args.command || '')}`;
  const bytes = String(args.content ?? '').length;
  return `write file: ${String(args.path || '')} (${bytes} bytes)`;
}

/**
 * OpenAI-compatible tool loop using the user's configured local model.
 * LM Studio supports tools; Ollama may depending on model — we try tools first.
 */
export async function runCasperToolLoop(
  history: { role: string; content: string }[],
  hooks: ToolLoopHooks = {}
): Promise<string> {
  const settings = await getModelSettings();
  const base =
    settings.provider === 'ollama'
      ? `${settings.ollama.replace(/\/$/, '')}/v1`
      : `${settings.lmstudio.replace(/\/$/, '')}/v1`;

  const messages: ChatMsg[] = [
    { role: 'system', content: CASPER_SYSTEM },
    ...history.map((m) => ({ role: m.role === 'casper' ? 'assistant' : m.role, content: m.content })),
  ];

  let finalText = '';
  for (let step = 0; step < 12; step++) {
    if (hooks.shouldAbort?.()) throw new Error('Directive aborted by operator.');

    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.model || undefined,
        messages,
        tools: LOCAL_TOOL_SPECS,
        tool_choice: 'auto',
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      // Fallback: no-tools completion (some local stacks reject tools)
      if (/tool/i.test(errText) || response.status === 400) {
        return runPlainCompletion(base, settings.model, messages, hooks);
      }
      throw new Error(`Model error: ${response.status} ${errText.slice(0, 300)}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0]?.message;
    if (!choice) throw new Error('Empty model response');

    const toolCalls = choice.tool_calls;
    const content = choice.content || choice.reasoning_content || '';
    if (content) {
      finalText += content;
      hooks.onToken?.(content);
    }

    if (!toolCalls?.length) {
      return finalText.trim() || content || '(Casper finished with no text.)';
    }

    messages.push({
      role: 'assistant',
      content: choice.content || null,
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      if (hooks.shouldAbort?.()) throw new Error('Directive aborted by operator.');
      const name = call.function?.name || call.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function?.arguments || call.arguments || '{}');
      } catch {
        args = {};
      }

      if (APPROVAL_REQUIRED.has(name) && hooks.confirm) {
        const ok = await hooks.confirm(name, args, approvalDetail(name, args));
        if (!ok) {
          const denied = { ok: false, error: 'Operator denied this action.' };
          hooks.onToolResult?.(name, denied);
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name,
            content: JSON.stringify(denied),
          });
          continue;
        }
      }

      hooks.onToolCall?.(name, args);
      const result = await runLocalTool(name, args);
      hooks.onToolResult?.(name, result);
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        name,
        content: JSON.stringify(result),
      });
    }
  }

  return finalText.trim() || 'Casper hit the tool-step limit. Try a smaller request.';
}

async function runPlainCompletion(
  base: string,
  model: string,
  messages: ChatMsg[],
  hooks: ToolLoopHooks
): Promise<string> {
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || undefined,
      messages: messages.map((m) => ({ role: m.role, content: m.content || '' })),
      stream: false,
    }),
  });
  if (!response.ok) throw new Error(`Model error: ${response.status}`);
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content
    || data.choices?.[0]?.message?.reasoning_content
    || '';
  if (text) hooks.onToken?.(text);
  return text;
}
