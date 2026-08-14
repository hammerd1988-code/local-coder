import { Router } from 'express';
import express from 'express';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import * as path from 'path';
import * as os from 'os';

// Full-filesystem access API used by the Server Ops GUI. Exposes the same
// capability level as the existing PTY terminal (arbitrary shell), so it
// follows the same trust model: the server binds to localhost by default.

const router = Router();

const MAX_TEXT_READ = 2 * 1024 * 1024; // 2 MB
const MAX_WRITE = 16 * 1024 * 1024; // 16 MB

function resolveAbs(p: unknown): string | null {
  if (typeof p !== 'string' || !p.trim()) return null;
  const expanded = p === '~' || p.startsWith('~/') ? path.join(os.homedir(), p.slice(1)) : p;
  if (!path.isAbsolute(expanded)) return null;
  return path.normalize(expanded);
}

function modeToString(mode: number, isDir: boolean, isLink: boolean): string {
  const flags = 'rwxrwxrwx';
  let out = isLink ? 'l' : isDir ? 'd' : '-';
  for (let i = 0; i < 9; i++) {
    out += mode & (1 << (8 - i)) ? flags[i] : '-';
  }
  return out;
}

// Cache uid/gid -> name lookups from /etc/passwd and /etc/group
let userMap: Map<number, string> | null = null;
let groupMap: Map<number, string> | null = null;
async function idMaps() {
  if (!userMap) {
    userMap = new Map();
    groupMap = new Map();
    try {
      const passwd = await fs.readFile('/etc/passwd', 'utf8');
      for (const line of passwd.split('\n')) {
        const [name, , uid] = line.split(':');
        if (name && uid) userMap.set(parseInt(uid, 10), name);
      }
    } catch { /* optional */ }
    try {
      const group = await fs.readFile('/etc/group', 'utf8');
      for (const line of group.split('\n')) {
        const [name, , gid] = line.split(':');
        if (name && gid) groupMap.set(parseInt(gid, 10), name);
      }
    } catch { /* optional */ }
  }
  return { userMap: userMap!, groupMap: groupMap! };
}

// GET /api/sysfs/list?path=/etc
router.get('/list', async (req, res) => {
  const dir = resolveAbs(req.query.path);
  if (!dir) {
    res.status(400).json({ error: 'path must be absolute' });
    return;
  }
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const { userMap, groupMap } = await idMaps();
    const items = await Promise.all(
      entries.map(async (e) => {
        const full = path.join(dir, e.name);
        try {
          const st = await fs.lstat(full);
          const isLink = st.isSymbolicLink();
          let linkTarget: string | undefined;
          let isDir = st.isDirectory();
          if (isLink) {
            try {
              linkTarget = await fs.readlink(full);
              isDir = (await fs.stat(full)).isDirectory();
            } catch { /* dangling symlink */ }
          }
          return {
            name: e.name,
            type: isDir ? 'dir' : 'file',
            symlink: isLink,
            linkTarget,
            size: st.size,
            mode: modeToString(st.mode, isDir, isLink),
            mtime: st.mtimeMs,
            owner: userMap.get(st.uid) ?? String(st.uid),
            group: groupMap.get(st.gid) ?? String(st.gid),
          };
        } catch {
          return { name: e.name, type: 'file' as const, symlink: false, size: 0, mode: '?????????', mtime: 0, owner: '?', group: '?' };
        }
      }),
    );
    items.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
    res.json({ path: dir, home: os.homedir(), items });
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? String(err) });
  }
});

// GET /api/sysfs/read?path=/etc/hosts
router.get('/read', async (req, res) => {
  const file = resolveAbs(req.query.path);
  if (!file) {
    res.status(400).json({ error: 'path must be absolute' });
    return;
  }
  try {
    const st = await fs.stat(file);
    if (!st.isFile()) {
      res.status(400).json({ error: 'Not a regular file' });
      return;
    }
    if (st.size > MAX_TEXT_READ) {
      res.json({ path: file, size: st.size, tooLarge: true });
      return;
    }
    const buf = await fs.readFile(file);
    if (buf.includes(0)) {
      res.json({ path: file, size: st.size, binary: true });
      return;
    }
    res.json({ path: file, size: st.size, content: buf.toString('utf8') });
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? String(err) });
  }
});

// POST /api/sysfs/write { path, content }
router.post('/write', express.json({ limit: MAX_WRITE }), async (req, res) => {
  const file = resolveAbs(req.body?.path);
  const content = req.body?.content;
  if (!file || typeof content !== 'string') {
    res.status(400).json({ error: 'path (absolute) and content are required' });
    return;
  }
  try {
    await fs.writeFile(file, content, 'utf8');
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? String(err) });
  }
});

// POST /api/sysfs/mkdir { path }
router.post('/mkdir', async (req, res) => {
  const dir = resolveAbs(req.body?.path);
  if (!dir) {
    res.status(400).json({ error: 'path must be absolute' });
    return;
  }
  try {
    await fs.mkdir(dir, { recursive: true });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? String(err) });
  }
});

// POST /api/sysfs/touch { path }
router.post('/touch', async (req, res) => {
  const file = resolveAbs(req.body?.path);
  if (!file) {
    res.status(400).json({ error: 'path must be absolute' });
    return;
  }
  try {
    await fs.writeFile(file, '', { flag: 'wx' });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? String(err) });
  }
});

// POST /api/sysfs/rename { from, to }
router.post('/rename', async (req, res) => {
  const from = resolveAbs(req.body?.from);
  const to = resolveAbs(req.body?.to);
  if (!from || !to) {
    res.status(400).json({ error: 'from and to must be absolute paths' });
    return;
  }
  try {
    await fs.rename(from, to);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? String(err) });
  }
});

// POST /api/sysfs/delete { path }
router.post('/delete', async (req, res) => {
  const target = resolveAbs(req.body?.path);
  if (!target || target === '/') {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }
  try {
    await fs.rm(target, { recursive: true, force: true });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? String(err) });
  }
});

// POST /api/sysfs/chmod { path, mode } — mode as octal string e.g. "755"
router.post('/chmod', async (req, res) => {
  const target = resolveAbs(req.body?.path);
  const mode = String(req.body?.mode ?? '');
  if (!target || !/^[0-7]{3,4}$/.test(mode)) {
    res.status(400).json({ error: 'path and octal mode required' });
    return;
  }
  try {
    await fs.chmod(target, parseInt(mode, 8));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? String(err) });
  }
});

// GET /api/sysfs/download?path=...
router.get('/download', async (req, res) => {
  const file = resolveAbs(req.query.path);
  if (!file) {
    res.status(400).json({ error: 'path must be absolute' });
    return;
  }
  try {
    const st = await fs.stat(file);
    if (!st.isFile()) {
      res.status(400).json({ error: 'Not a regular file' });
      return;
    }
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(file).replace(/"/g, '')}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(st.size));
    createReadStream(file).pipe(res);
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? String(err) });
  }
});

// PUT /api/sysfs/upload?path=/target/dir/file.bin — raw body
router.put('/upload', express.raw({ type: '*/*', limit: MAX_WRITE }), async (req, res) => {
  const file = resolveAbs(req.query.path);
  if (!file) {
    res.status(400).json({ error: 'path must be absolute' });
    return;
  }
  try {
    const body: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    await fs.writeFile(file, body);
    res.json({ ok: true, size: body.length });
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? String(err) });
  }
});

export default router;
