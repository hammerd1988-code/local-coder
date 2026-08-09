import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { simpleGit } from 'simple-git';
import {
  getWorkspaceRoot,
  listWorkspaceFiles,
  readWorkspaceFile,
  resolveInWorkspace,
  writeWorkspaceFile,
} from '../workspace.js';

const execAsync = promisify(exec);

export type ToolResult = { ok: boolean; data?: unknown; error?: string };

export const LOCAL_TOOL_SPECS = [
  {
    type: 'function' as const,
    function: {
      name: 'local__shell',
      description: '[Local] Execute a shell command in the workspace.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command' },
          cwd: { type: 'string', description: 'Working directory relative to workspace' },
          timeout_ms: { type: 'number', description: 'Timeout ms' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'local__read_file',
      description: '[Local] Read a workspace file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'local__write_file',
      description: '[Local] Write/create a workspace file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path' },
          content: { type: 'string', description: 'File content' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'local__search_files',
      description: '[Local] List/search workspace file paths by substring.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Substring or glob-ish pattern' },
          max_results: { type: 'number' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'local__git',
      description: '[Local] Git status/diff/log/add/commit/branch/checkout.',
      parameters: {
        type: 'object',
        properties: {
          operation: { type: 'string', description: 'status|diff|log|add|commit|branch|checkout' },
          message: { type: 'string' },
          branch_name: { type: 'string' },
          files: { type: 'string' },
        },
        required: ['operation'],
      },
    },
  },
];

export const CAPABILITY_NAMES = LOCAL_TOOL_SPECS.map((t) => t.function.name);

async function requireRoot(): Promise<string> {
  const root = await getWorkspaceRoot();
  if (!root) throw new Error('No workspace folder open. Open a folder in Local Code first.');
  return root;
}

export async function runLocalTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const started = Date.now();
  try {
    let data: unknown;
    switch (name) {
      case 'local__shell': {
        const root = await requireRoot();
        const command = String(args.command || '');
        if (!command) throw new Error('command required');
        const cwdRel = args.cwd ? String(args.cwd) : '';
        const cwd = cwdRel ? resolveInWorkspace(root, cwdRel) : root;
        const timeout = Math.min(Number(args.timeout_ms) || 120000, 600000);
        const { stdout, stderr } = await execAsync(command, {
          cwd,
          timeout,
          maxBuffer: 2 * 1024 * 1024,
          shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
        });
        data = { stdout, stderr, cwd };
        break;
      }
      case 'local__read_file': {
        const root = await requireRoot();
        const file = await readWorkspaceFile(root, String(args.path || ''));
        data = { path: file.path, content: file.content, language: file.language };
        break;
      }
      case 'local__write_file': {
        const root = await requireRoot();
        const file = await writeWorkspaceFile(root, String(args.path || ''), String(args.content ?? ''));
        data = { path: file.path, bytes: file.content.length };
        break;
      }
      case 'local__search_files': {
        const root = await requireRoot();
        const pattern = String(args.pattern || '').toLowerCase();
        const max = Math.min(Number(args.max_results) || 50, 200);
        const files = await listWorkspaceFiles(root);
        data = files
          .filter((f) => f.path.toLowerCase().includes(pattern) || path.basename(f.path).toLowerCase().includes(pattern))
          .slice(0, max)
          .map((f) => f.path);
        break;
      }
      case 'local__git': {
        const root = await requireRoot();
        const git = simpleGit(root);
        const op = String(args.operation || 'status');
        if (op === 'status') data = await git.status();
        else if (op === 'diff') data = await git.diff();
        else if (op === 'log') data = await git.log({ maxCount: Math.min(Number(args.count) || 20, 50) });
        else if (op === 'branch') data = await git.branchLocal();
        else if (op === 'checkout') data = await git.checkout(String(args.branch_name || ''));
        else if (op === 'add') data = await git.add(String(args.files || '.'));
        else if (op === 'commit') data = await git.commit(String(args.message || 'casper commit'));
        else throw new Error(`Unsupported git operation: ${op}`);
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    void started;
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Write an inbox file under the workspace (for remote file:push). */
export async function writeInboxFile(fileName: string, content: Buffer): Promise<{ relativePath: string; size: number }> {
  const root = await requireRoot();
  const safe = path.basename(fileName.replace(/\\/g, '/')).replace(/[<>:"|?*\x00-\x1f]/g, '_').slice(0, 200) || `upload-${Date.now()}`;
  const rel = path.join('casper-inbox', safe).replace(/\\/g, '/');
  const abs = resolveInWorkspace(root, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content);
  return { relativePath: rel, size: content.length };
}
