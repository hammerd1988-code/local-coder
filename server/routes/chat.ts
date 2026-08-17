import express from 'express';
import { db } from '../db.js';
import { resolveModel } from '../model-resolver.js';

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

async function getSettings() {
  const rows = await db.selectFrom('settings')
    .select(['key', 'value'])
    .execute();
  return (key: string) => rows.find((s) => s.key === key)?.value;
}

// List models actually available on each provider, so the client can offer a
// picker instead of a free-text field (typos there fail as opaque 500s).
router.get('/models', async (_req: express.Request, res: express.Response) => {
  const setting = await getSettings();
  const result: { provider: string; models: string[] }[] = [];

  const lmstudioUrl = setting('lmstudio_base_url') || 'http://localhost:1234';
  try {
    const r = await fetch(`${lmstudioUrl}/v1/models`, { signal: AbortSignal.timeout(3000) });
    const data = await r.json();
    result.push({ provider: 'lmstudio', models: (data.data ?? []).map((m: any) => m.id) });
  } catch {
    result.push({ provider: 'lmstudio', models: [] });
  }

  const ollamaUrl = setting('ollama_base_url') || 'http://localhost:11434';
  try {
    const r = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    const data = await r.json();
    result.push({ provider: 'ollama', models: (data.models ?? []).map((m: any) => m.name) });
  } catch {
    result.push({ provider: 'ollama', models: [] });
  }

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
    const setting = await getSettings();
    const provider = setting('model_provider') || 'ollama';

    if (provider === 'lmstudio') {
      // LM Studio speaks the OpenAI API: SSE lines carrying delta objects
      const baseUrl = setting('lmstudio_base_url') || 'http://localhost:1234';
      const target = await resolveModel('lmstudio', model, baseUrl);
      if (!target) {
        throw new Error('No model loaded in LM Studio — load one, or set a model name in settings.');
      }
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: target, messages, stream: true })
      });

      if (!response.ok || !response.body) {
        throw new Error(`LM Studio API error: ${response.statusText}`);
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
      const baseUrl = setting('ollama_base_url') || 'http://localhost:11434';
      const target = (await resolveModel('ollama', model, baseUrl)) || 'llama3';
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
