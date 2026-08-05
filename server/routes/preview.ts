import { Router } from 'express';
import { db } from '../db.js';

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

// Cheap change detector so the client knows when to reload the iframe
router.get('/version', async (_req, res) => {
  const row = await db.selectFrom('files')
    .select((eb) => [
      eb.fn.max('updated_at').as('latest'),
      eb.fn.countAll().as('count')
    ])
    .executeTakeFirst();
  res.json({ version: `${row?.latest ?? 0}-${row?.count ?? 0}` });
  return;
});

// Serve project files from the database so a preview iframe can load
// /api/preview/index.html and have relative asset links resolve naturally.
router.use(async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const path = decodeURIComponent(req.path.replace(/^\/+/, ''));
  if (!path) {
    res.status(404).send('Not found');
    return;
  }

  const file = await db.selectFrom('files')
    .selectAll()
    .where('path', '=', path)
    .executeTakeFirst();

  if (!file) {
    res.status(404).send(`No file named "${path}" in the project`);
    return;
  }

  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  res.setHeader('Content-Type', MIME_TYPES[ext] ?? 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(file.content);
  return;
});

export default router;
