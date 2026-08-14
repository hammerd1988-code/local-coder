import express from 'express';
import { db } from '../db.js';
import {
  applyWorkspaceFiles,
  deleteWorkspaceFile,
  findById,
  getWorkspaceRoot,
  languageFromPath,
  listWorkspaceFiles,
  readWorkspaceFile,
  writeWorkspaceFile,
} from '../workspace.js';
import { fileOperationsTotal, fileOperationDuration, filesInDatabase, timeOperation } from '../metrics.js';

const router = express.Router();

// List files (disk workspace when configured, otherwise SQLite)
router.get('/', async (_req: express.Request, res: express.Response) => {
  try {
    const root = await getWorkspaceRoot();
    if (root) {
      const files = await timeOperation(
        () => listWorkspaceFiles(root),
        fileOperationDuration,
        { operation: 'list' }
      );
      filesInDatabase.set(files.length);
      fileOperationsTotal.labels('list', 'success').inc();
      res.json(files);
      return;
    }

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

// Batch apply (agent / multi-file write) — must be before /:id
router.post('/apply', async (req: express.Request, res: express.Response) => {
  try {
    const root = await getWorkspaceRoot();
    const { files } = req.body as { files?: { path: string; content: string }[] };
    if (!Array.isArray(files) || files.length === 0) {
      res.status(400).json({ error: 'files array required' });
      return;
    }
    if (files.length > 40) {
      res.status(400).json({ error: 'Too many files in one apply (max 40)' });
      return;
    }

    if (root) {
      const written = await applyWorkspaceFiles(root, files);
      res.json({ source: 'disk', files: written });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const written: {
      id: number;
      path: string;
      content: string;
      language: string;
      created_at: number;
      updated_at: number;
    }[] = [];
    for (const file of files) {
      const existing = await db.selectFrom('files').selectAll().where('path', '=', file.path).executeTakeFirst();
      if (existing) {
        const row = await db.updateTable('files')
          .set({ content: file.content, language: languageFromPath(file.path), updated_at: now })
          .where('id', '=', existing.id)
          .returning(['id', 'path', 'content', 'language', 'created_at', 'updated_at'])
          .executeTakeFirstOrThrow();
        written.push(row);
      } else {
        const row = await db.insertInto('files')
          .values({
            path: file.path,
            content: file.content,
            language: languageFromPath(file.path),
            created_at: now,
            updated_at: now,
          })
          .returning(['id', 'path', 'content', 'language', 'created_at', 'updated_at'])
          .executeTakeFirstOrThrow();
        written.push(row);
      }
    }
    res.json({ source: 'db', files: written });
    return;
  } catch (error) {
    console.error('Error applying files:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to apply files' });
    return;
  }
});

// Get single file
router.get('/:id', async (req: express.Request, res: express.Response) => {
  try {
    const root = await getWorkspaceRoot();
    const id = parseInt(String(req.params.id), 10);

    if (root) {
      const file = await timeOperation(() => findById(root, id), fileOperationDuration, { operation: 'read' });
      if (!file) {
        fileOperationsTotal.labels('read', 'not_found').inc();
        res.status(404).json({ error: 'File not found' });
        return;
      }
      fileOperationsTotal.labels('read', 'success').inc();
      res.json(file);
      return;
    }

    const file = await timeOperation(
      () => db.selectFrom('files').selectAll().where('id', '=', id).executeTakeFirst(),
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
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch file' });
    return;
  }
});

// Create file
router.post('/', async (req: express.Request, res: express.Response) => {
  try {
    const { path: filePath, content, language } = req.body;
    if (!filePath) {
      fileOperationsTotal.labels('create', 'validation_error').inc();
      res.status(400).json({ error: 'Path is required' });
      return;
    }

    const root = await getWorkspaceRoot();
    if (root) {
      const file = await timeOperation(
        () => writeWorkspaceFile(root, filePath, content || ''),
        fileOperationDuration,
        { operation: 'create' }
      );
      fileOperationsTotal.labels('create', 'success').inc();
      res.status(201).json(file);
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const result = await timeOperation(
      () => db.insertInto('files')
        .values({
          path: filePath,
          content: content || '',
          language: language || languageFromPath(filePath),
          created_at: now,
          updated_at: now,
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
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create file' });
    return;
  }
});

// Update file
router.put('/:id', async (req: express.Request, res: express.Response) => {
  try {
    const { content, language } = req.body;
    const id = parseInt(String(req.params.id), 10);
    const root = await getWorkspaceRoot();

    if (root) {
      const existing = await findById(root, id);
      if (!existing) {
        fileOperationsTotal.labels('update', 'not_found').inc();
        res.status(404).json({ error: 'File not found' });
        return;
      }
      const file = await timeOperation(
        () => writeWorkspaceFile(root, existing.path, content ?? ''),
        fileOperationDuration,
        { operation: 'update' }
      );
      fileOperationsTotal.labels('update', 'success').inc();
      res.json({ ...file, language: language || file.language });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const result = await timeOperation(
      () => db.updateTable('files')
        .set({ content, language, updated_at: now })
        .where('id', '=', id)
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
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update file' });
    return;
  }
});

// Delete file
router.delete('/:id', async (req: express.Request, res: express.Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const root = await getWorkspaceRoot();

    if (root) {
      const existing = await findById(root, id);
      if (!existing) {
        fileOperationsTotal.labels('delete', 'not_found').inc();
        res.status(404).json({ error: 'File not found' });
        return;
      }
      await timeOperation(() => deleteWorkspaceFile(root, existing.path), fileOperationDuration, { operation: 'delete' });
      fileOperationsTotal.labels('delete', 'success').inc();
      res.status(204).send();
      return;
    }

    const result = await timeOperation(
      () => db.deleteFrom('files').where('id', '=', id).executeTakeFirst(),
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
