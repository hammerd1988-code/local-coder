import express from 'express';
import { db } from '../db.js';
import { authHeaders, resolveModel } from '../model-resolver.js';
import {
  getModelSettings,
  listOpenRouterModels,
  normalizeBaseUrl,
  resolveCompletionTarget,
} from '../model-provider.js';
import { refreshBscModelIfFollowing } from '../casper/bsc-model-sync.js';

const router = express.Router();

// Get chat history
router.get('/messages', async (req: express.Request, res: express.Response) => {
  try {
    const messages = await db.selectFrom('chat_messages')
      .selectAll()
      .orderBy('created_at', 'asc')
      .execute();
    
    res.json(messages);
    return;
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
    return;
  }
});

// Add message
router.post('/messages', async (req: express.Request, res: express.Response) => {
  try {
    const { role, content } = req.body;
    
    if (!role || !content) {
      res.status(400).json({ error: 'Role and content are required' });
      return;
    }
    
    const now = Math.floor(Date.now() / 1000);
    
    const result = await db.insertInto('chat_messages')
      .values({
        role,
        content,
        created_at: now
      })
      .returning(['id', 'role', 'content', 'created_at'])
      .executeTakeFirst();
    
    res.status(201).json(result);
    return;
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ error: 'Failed to create message' });
    return;
  }
});

// Clear chat history
router.delete('/messages', async (req: express.Request, res: express.Response) => {
  try {
    await db.deleteFrom('chat_messages').execute();
    res.status(204).send();
    return;
  } catch (error) {
    console.error('Error clearing messages:', error);
    res.status(500).json({ error: 'Failed to clear messages' });
    return;
  }
});

// List models actually available on each provider, so the client can offer a
// picker instead of a free-text field (typos there fail as opaque 500s).
router.get('/models', async (_req: express.Request, res: express.Response) => {
  const settings = await getModelSettings();
  const lmstudioUrl = normalizeBaseUrl(settings.lmstudioBaseUrl);
  const ollamaUrl = normalizeBaseUrl(settings.ollamaBaseUrl);
  const openaiUrl = normalizeBaseUrl(settings.openaiBaseUrl);

  const catalog = async (provider: string, load: () => Promise<string[]>) => {
    try {
      return { provider, models: await load() };
    } catch {
      return { provider, models: [] };
    }
  };

  // Independent providers are probed concurrently so a stopped local server
  // or an offline machine doesn't stack up timeouts. Cloud catalogs are only
  // fetched for the provider actually in use.
  const result = await Promise.all([
    catalog('lmstudio', async () => {
      const r = await fetch(`${lmstudioUrl}/v1/models`, {
        headers: authHeaders(settings.lmstudioApiKey),
        signal: AbortSignal.timeout(3000),
      });
      const data = await r.json();
      return (data.data ?? []).map((m: any) => m.id);
    }),
    catalog('ollama', async () => {
      const r = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      const data = await r.json();
      return (data.models ?? []).map((m: any) => m.name);
    }),
    catalog('openrouter', async () => (
      settings.provider === 'openrouter' ? listOpenRouterModels(settings.openrouterApiKey) : []
    )),
    catalog('openai', async () => {
      if (settings.provider !== 'openai' || !openaiUrl) return [];
      const r = await fetch(`${openaiUrl}/v1/models`, {
        headers: authHeaders(settings.openaiApiKey),
        signal: AbortSignal.timeout(4000),
      });
      const data = await r.json();
      return (data.data ?? []).map((m: any) => String(m.id)).filter(Boolean).sort();
    }),
  ]);

  res.json(result);
  return;
});

/** Split an incoming byte stream into complete lines, buffering partials. */
async function* lines(body: AsyncIterable<Uint8Array>) {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      yield buffer.slice(0, idx).replace(/\r$/, '');
      buffer = buffer.slice(idx + 1);
    }
  }
  if (buffer.trim()) yield buffer;
}

// Chat completion with local model, streamed back as server-sent events:
//   data: {"type":"content"|"reasoning","delta":string}
//   data: {"type":"done"}
//   data: {"type":"error","message":string}
router.post('/complete', async (req: express.Request, res: express.Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: object) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    const { messages, model } = req.body;
    // While following BSC-V3 the configured model is authoritative; the
    // browser's copy of it may predate a sync.
    const sync = await refreshBscModelIfFollowing();
    const requestedModel = sync === 'not-following' ? model : undefined;
    const settings = await getModelSettings();
    const provider = settings.provider;

    if (provider !== 'ollama') {
      // LM Studio, OpenRouter and OpenAI-compatible servers all speak the
      // OpenAI API: SSE lines carrying delta objects
      const target = await resolveCompletionTarget(settings, requestedModel);
      if (!target.model) {
        throw new Error('No model loaded in LM Studio — load one, or set a model name in settings. If LM Studio requires an API token, set it in settings.');
      }
      const response = await fetch(`${target.openAiBase}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...target.headers, ...authHeaders(target.apiKey) },
        body: JSON.stringify({ model: target.model, messages, stream: true })
      });

      if (!response.ok || !response.body) {
        const detail = (await response.text().catch(() => '')).slice(0, 300);
        throw new Error(`${target.provider === 'lmstudio' ? 'LM Studio' : target.provider === 'openrouter' ? 'OpenRouter' : 'Model'} API error: ${response.status} ${detail || response.statusText}`);
      }

      for await (const line of lines(response.body as any)) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6);
        if (payload === '[DONE]') break;
        const delta = JSON.parse(payload).choices?.[0]?.delta ?? {};
        if (delta.reasoning_content) send({ type: 'reasoning', delta: delta.reasoning_content });
        if (delta.content) send({ type: 'content', delta: delta.content });
      }
    } else {
      // Ollama streams newline-delimited JSON objects
      const baseUrl = normalizeBaseUrl(settings.ollamaBaseUrl);
      const target = (await resolveModel('ollama', requestedModel || settings.model, baseUrl)) || 'llama3';
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: target, messages, stream: true })
      });

      if (!response.ok || !response.body) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      for await (const line of lines(response.body as any)) {
        if (!line.trim()) continue;
        const data = JSON.parse(line);
        if (data.message?.thinking) send({ type: 'reasoning', delta: data.message.thinking });
        if (data.message?.content) send({ type: 'content', delta: data.message.content });
        if (data.done) break;
      }
    }

    send({ type: 'done' });
  } catch (error) {
    console.error('Error calling model provider:', error);
    send({ type: 'error', message: error instanceof Error ? error.message : 'Completion failed' });
  } finally {
    res.end();
  }
});

export default router;
