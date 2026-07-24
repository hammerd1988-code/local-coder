import express from 'express';
import { db } from '../db.js';
import { fileOperationsTotal, fileOperationDuration, filesInDatabase, timeOperation } from '../metrics.js';

const router = express.Router();

// Get all files
router.get('/', async (req: express.Request, res: express.Response) => {
  try {
    const files = await timeOperation(
      () => db.selectFrom('files').selectAll().orderBy('path', 'asc').execute(),
      fileOperationDuration,
      { operation: 'list' }
    );
    
    filesInDatabase.set(files.length);
    fileOperationsTotal.labels('list', 'success').inc();
    res.json(files);
    return;
  } catch (error) {
    console.error('Error fetching files:', error);
    fileOperationsTotal.labels('list', 'error').inc();
    res.status(500).json({ error: 'Failed to fetch files' });
    return;
  }
});

// Get single file
router.get('/:id', async (req: express.Request, res: express.Response) => {
  try {
    const file = await timeOperation(
      () => db.selectFrom('files').selectAll().where('id', '=', parseInt(req.params.id)).executeTakeFirst(),
      fileOperationDuration,
      { operation: 'read' }
    );
    
    if (!file) {
      fileOperationsTotal.labels('read', 'not_found').inc();
      res.status(404).json({ error: 'File not found' });
      return;
    }
    
    fileOperationsTotal.labels('read', 'success').inc();
    res.json(file);
    return;
  } catch (error) {
    console.error('Error fetching file:', error);
    fileOperationsTotal.labels('read', 'error').inc();
    res.status(500).json({ error: 'Failed to fetch file' });
    return;
  }
});

// Create file
router.post('/', async (req: express.Request, res: express.Response) => {
  try {
    const { path, content, language } = req.body;
    
    if (!path) {
      fileOperationsTotal.labels('create', 'validation_error').inc();
      res.status(400).json({ error: 'Path is required' });
      return;
    }
    
    const now = Math.floor(Date.now() / 1000);
    
    const result = await timeOperation(
      () => db.insertInto('files')
        .values({
          path,
          content: content || '',
          language: language || 'plaintext',
          created_at: now,
          updated_at: now
        })
        .returning(['id', 'path', 'content', 'language', 'created_at', 'updated_at'])
        .executeTakeFirst(),
      fileOperationDuration,
      { operation: 'create' }
    );
    
    fileOperationsTotal.labels('create', 'success').inc();
    res.status(201).json(result);
    return;
  } catch (error) {
    console.error('Error creating file:', error);
    fileOperationsTotal.labels('create', 'error').inc();
    res.status(500).json({ error: 'Failed to create file' });
    return;
  }
});

// Update file
router.put('/:id', async (req: express.Request, res: express.Response) => {
  try {
    const { content, language } = req.body;
    const now = Math.floor(Date.now() / 1000);
    
    const result = await timeOperation(
      () => db.updateTable('files')
        .set({
          content,
          language,
          updated_at: now
        })
        .where('id', '=', parseInt(req.params.id))
        .returning(['id', 'path', 'content', 'language', 'created_at', 'updated_at'])
        .executeTakeFirst(),
      fileOperationDuration,
      { operation: 'update' }
    );
    
    if (!result) {
      fileOperationsTotal.labels('update', 'not_found').inc();
      res.status(404).json({ error: 'File not found' });
      return;
    }
    
    fileOperationsTotal.labels('update', 'success').inc();
    res.json(result);
    return;
  } catch (error) {
    console.error('Error updating file:', error);
    fileOperationsTotal.labels('update', 'error').inc();
    res.status(500).json({ error: 'Failed to update file' });
    return;
  }
});

// Delete file
router.delete('/:id', async (req: express.Request, res: express.Response) => {
  try {
    const result = await timeOperation(
      () => db.deleteFrom('files').where('id', '=', parseInt(req.params.id)).executeTakeFirst(),
      fileOperationDuration,
      { operation: 'delete' }
    );
    
    if (result.numDeletedRows === 0n) {
      fileOperationsTotal.labels('delete', 'not_found').inc();
      res.status(404).json({ error: 'File not found' });
      return;
    }
    
    fileOperationsTotal.labels('delete', 'success').inc();
    res.status(204).send();
    return;
  } catch (error) {
    console.error('Error deleting file:', error);
    fileOperationsTotal.labels('delete', 'error').inc();
    res.status(500).json({ error: 'Failed to delete file' });
    return;
  }
});

export default router;
