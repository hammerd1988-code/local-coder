import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// Get all files
router.get('/', async (req: express.Request, res: express.Response) => {
  try {
    const files = await db.selectFrom('files')
      .selectAll()
      .orderBy('path', 'asc')
      .execute();
    
    res.json(files);
    return;
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
    return;
  }
});

// Get single file
router.get('/:id', async (req: express.Request, res: express.Response) => {
  try {
    const file = await db.selectFrom('files')
      .selectAll()
      .where('id', '=', parseInt(req.params.id))
      .executeTakeFirst();
    
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    
    res.json(file);
    return;
  } catch (error) {
    console.error('Error fetching file:', error);
    res.status(500).json({ error: 'Failed to fetch file' });
    return;
  }
});

// Create file
router.post('/', async (req: express.Request, res: express.Response) => {
  try {
    const { path, content, language } = req.body;
    
    if (!path) {
      res.status(400).json({ error: 'Path is required' });
      return;
    }
    
    const now = Math.floor(Date.now() / 1000);
    
    const result = await db.insertInto('files')
      .values({
        path,
        content: content || '',
        language: language || 'plaintext',
        created_at: now,
        updated_at: now
      })
      .returning(['id', 'path', 'content', 'language', 'created_at', 'updated_at'])
      .executeTakeFirst();
    
    res.status(201).json(result);
    return;
  } catch (error) {
    console.error('Error creating file:', error);
    res.status(500).json({ error: 'Failed to create file' });
    return;
  }
});

// Update file
router.put('/:id', async (req: express.Request, res: express.Response) => {
  try {
    const { content, language } = req.body;
    const now = Math.floor(Date.now() / 1000);
    
    const result = await db.updateTable('files')
      .set({
        content,
        language,
        updated_at: now
      })
      .where('id', '=', parseInt(req.params.id))
      .returning(['id', 'path', 'content', 'language', 'created_at', 'updated_at'])
      .executeTakeFirst();
    
    if (!result) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    
    res.json(result);
    return;
  } catch (error) {
    console.error('Error updating file:', error);
    res.status(500).json({ error: 'Failed to update file' });
    return;
  }
});

// Delete file
router.delete('/:id', async (req: express.Request, res: express.Response) => {
  try {
    const result = await db.deleteFrom('files')
      .where('id', '=', parseInt(req.params.id))
      .executeTakeFirst();
    
    if (result.numDeletedRows === 0n) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    
    res.status(204).send();
    return;
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
    return;
  }
});

export default router;
