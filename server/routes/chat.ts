import express from 'express';
import { db } from '../db.js';

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

// Chat completion with local model
router.post('/complete', async (req: express.Request, res: express.Response) => {
  try {
    const { messages, model } = req.body;

    const settings = await db.selectFrom('settings')
      .select(['key', 'value'])
      .execute();
    const setting = (key: string) => settings.find((s) => s.key === key)?.value;

    const provider = setting('model_provider') || 'ollama';

    // LM Studio speaks the OpenAI API, not Ollama's, so it needs a different
    // endpoint and its response is reshaped to match what the client reads.
    if (provider === 'lmstudio') {
      const baseUrl = setting('lmstudio_base_url') || 'http://localhost:1234';

      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`LM Studio API error: ${response.statusText}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0]?.message;

      // Reasoning models (Qwen3, DeepSeek-R1) leave `content` empty and put
      // their output in `reasoning_content` instead.
      const content = choice?.content?.trim()
        ? choice.content
        : choice?.reasoning_content ?? '';

      res.json({
        message: { role: choice?.role ?? 'assistant', content },
        model: data.model,
        usage: data.usage
      });
      return;
    }

    const baseUrl = setting('ollama_base_url') || 'http://localhost:11434';

    // Call Ollama API
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'codellama',
        messages,
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    res.json(data);
    return;
  } catch (error) {
    console.error('Error calling model provider:', error);
    res.status(500).json({ error: 'Failed to get completion from model' });
    return;
  }
});

export default router;
