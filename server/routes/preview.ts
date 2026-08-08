import { Router } from 'express';
import fs from 'fs/promises';
import { db } from '../db.js';
import { getWorkspaceRoot, listWorkspaceFiles, readWorkspaceFile, resolveInWorkspace } from '../workspace.js';

const router = Router();

const MIME_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  xml: 'application/xml; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  md: 'text/plain; charset=utf-8'
};

router.get('/version', async (_req, res) => {
  try {
    const root = await getWorkspaceRoot();
    if (root) {
      const files = await listWorkspaceFiles(root);
      let latest = 0;
      for (const f of files.slice(0, 300)) {
        try {
          const st = await fs.stat(resolveInWorkspace(root, f.path));
          const t = Math.floor(st.mtimeMs / 1000);
          if (t > latest) latest = t;
        } catch {
          // skip
        }
      }
      res.json({ version: `disk-${latest}-${files.length}` });
      return;
    }

    const row = await db.selectFrom('files')
      .select((eb) => [
        eb.fn.max('updated_at').as('latest'),
        eb.fn.countAll().as('count')
      ])
      .executeTakeFirst();
    res.json({ version: `${row?.latest ?? 0}-${row?.count ?? 0}` });
    return;
  } catch (error) {
    console.error('Error computing preview version:', error);
    res.json({ version: String(Date.now()) });
    return;
  }
});

router.use(async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const filePath = decodeURIComponent(req.path.replace(/^\/+/, ''));
  if (!filePath) {
    res.status(404).send('Not found');
    return;
  }

  try {
    const root = await getWorkspaceRoot();
    if (root) {
      try {
        const file = await readWorkspaceFile(root, filePath);
        const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
        res.setHeader('Content-Type', MIME_TYPES[ext] ?? 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.send(file.content);
        return;
      } catch {
        // fall through to 404
        res.status(404).send(`No file named "${filePath}" in the workspace`);
        return;
      }
    }

    const file = await db.selectFrom('files')
      .selectAll()
      .where('path', '=', filePath)
      .executeTakeFirst();

    if (!file) {
      res.status(404).send(`No file named "${filePath}" in the project`);
      return;
    }

    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    res.setHeader('Content-Type', MIME_TYPES[ext] ?? 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(file.content);
    return;
  } catch (error) {
    console.error('Preview serve error:', error);
    res.status(500).send('Preview error');
    return;
  }
});

export default router;
