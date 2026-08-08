import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { db } from './db.js';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.vite', 'coverage',
  '__pycache__', '.cache', 'data',
]);

const TEXT_EXT = new Set([
  'txt', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'css', 'scss',
  'html', 'htm', 'svg', 'xml', 'yml', 'yaml', 'toml', 'ini', 'env', 'sh', 'ps1',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'c', 'h', 'cpp', 'hpp', 'cs', 'php',
  'sql', 'graphql', 'vue', 'svelte', 'astro', 'dockerfile', 'gitignore',
  'editorconfig', 'prettierrc', 'eslintrc', 'bat', 'cmd', 'vue',
]);

const MAX_FILE_BYTES = 1_500_000;
const MAX_LIST = 2000;

/** Stable positive int id from a relative path (client still expects numeric ids). */
export function pathToId(relPath: string): number {
  let hash = 2166136261;
  const normalized = relPath.replace(/\\/g, '/');
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2147483646 + 1;
}

export function languageFromPath(relPath: string): string {
  const base = path.basename(relPath).toLowerCase();
  if (base === 'dockerfile') return 'dockerfile';
  const ext = path.extname(relPath).slice(1).toLowerCase();
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    py: 'python', rb: 'ruby', rs: 'rust', go: 'go',
    md: 'markdown', yml: 'yaml', yaml: 'yaml',
    htm: 'html', html: 'html', css: 'css', scss: 'scss',
    json: 'json', svg: 'xml', sh: 'shell', ps1: 'powershell',
  };
  return map[ext] || ext || 'plaintext';
}

export async function getWorkspaceRoot(): Promise<string | null> {
  const row = await db.selectFrom('settings')
    .select('value')
    .where('key', '=', 'workspace_root')
    .executeTakeFirst();
  const root = row?.value?.trim();
  if (!root) return null;
  if (!fsSync.existsSync(root) || !fsSync.statSync(root).isDirectory()) return null;
  return path.resolve(root);
}

export async function setWorkspaceRoot(root: string | null): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (!root) {
    await db.insertInto('settings')
      .values({ key: 'workspace_root', value: '', updated_at: now })
      .onConflict((oc) => oc.column('key').doUpdateSet({ value: '', updated_at: now }))
      .execute();
    return null;
  }
  const resolved = path.resolve(root);
  if (!fsSync.existsSync(resolved) || !fsSync.statSync(resolved).isDirectory()) {
    throw new Error(`Not a directory: ${resolved}`);
  }
  await db.insertInto('settings')
    .values({ key: 'workspace_root', value: resolved, updated_at: now })
    .onConflict((oc) => oc.column('key').doUpdateSet({ value: resolved, updated_at: now }))
    .execute();
  return resolved;
}

/** Resolve a relative path inside the workspace; throws if it escapes. */
export function resolveInWorkspace(root: string, relPath: string): string {
  const cleaned = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!cleaned || cleaned.includes('\0') || cleaned.split('/').some((p) => p === '..')) {
    throw new Error('Invalid path');
  }
  const abs = path.resolve(root, cleaned);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (abs !== root && !abs.startsWith(rootWithSep)) {
    throw new Error('Path escapes workspace');
  }
  return abs;
}

function isProbablyText(relPath: string, buf: Buffer): boolean {
  const ext = path.extname(relPath).slice(1).toLowerCase();
  const base = path.basename(relPath).toLowerCase();
  if (TEXT_EXT.has(ext) || TEXT_EXT.has(base) || !ext) {
    // reject if too many nulls
    const sample = buf.subarray(0, Math.min(buf.length, 8000));
    let weird = 0;
    for (const b of sample) {
      if (b === 0) weird++;
    }
    return weird < 4;
  }
  return false;
}

async function walk(root: string, dir: string, out: string[]): Promise<void> {
  if (out.length >= MAX_LIST) return;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (out.length >= MAX_LIST) return;
    if (entry.name.startsWith('.') && entry.name !== '.env.example' && entry.name !== '.gitignore') {
      if (entry.name !== '.localcoderules') continue;
    }
    if (SKIP_DIRS.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(root, abs, out);
    } else if (entry.isFile()) {
      out.push(path.relative(root, abs).replace(/\\/g, '/'));
    }
  }
}

export interface WorkspaceFile {
  id: number;
  path: string;
  content: string;
  language: string;
  created_at: number;
  updated_at: number;
  source: 'disk';
}

export async function listWorkspaceFiles(root: string): Promise<Omit<WorkspaceFile, 'content'>[]> {
  const paths: string[] = [];
  await walk(root, root, paths);
  paths.sort();
  const now = Math.floor(Date.now() / 1000);
  return paths.map((p) => ({
    id: pathToId(p),
    path: p,
    language: languageFromPath(p),
    created_at: now,
    updated_at: now,
    source: 'disk' as const,
  }));
}

export async function readWorkspaceFile(root: string, relPath: string): Promise<WorkspaceFile> {
  const abs = resolveInWorkspace(root, relPath);
  const stat = await fs.stat(abs);
  if (!stat.isFile()) throw new Error('Not a file');
  if (stat.size > MAX_FILE_BYTES) throw new Error('File too large');
  const buf = await fs.readFile(abs);
  if (!isProbablyText(relPath, buf)) throw new Error('Binary file not supported in editor');
  const content = buf.toString('utf8');
  const mtime = Math.floor(stat.mtimeMs / 1000);
  return {
    id: pathToId(relPath.replace(/\\/g, '/')),
    path: relPath.replace(/\\/g, '/'),
    content,
    language: languageFromPath(relPath),
    created_at: Math.floor(stat.birthtimeMs / 1000) || mtime,
    updated_at: mtime,
    source: 'disk',
  };
}

export async function findById(root: string, id: number): Promise<WorkspaceFile | null> {
  const listed = await listWorkspaceFiles(root);
  const meta = listed.find((f) => f.id === id);
  if (!meta) return null;
  return readWorkspaceFile(root, meta.path);
}

export async function writeWorkspaceFile(
  root: string,
  relPath: string,
  content: string
): Promise<WorkspaceFile> {
  const abs = resolveInWorkspace(root, relPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
  return readWorkspaceFile(root, relPath.replace(/\\/g, '/'));
}

export async function deleteWorkspaceFile(root: string, relPath: string): Promise<void> {
  const abs = resolveInWorkspace(root, relPath);
  await fs.unlink(abs);
}

export async function applyWorkspaceFiles(
  root: string,
  files: { path: string; content: string }[]
): Promise<WorkspaceFile[]> {
  const results: WorkspaceFile[] = [];
  for (const file of files) {
    results.push(await writeWorkspaceFile(root, file.path, file.content));
  }
  return results;
}
