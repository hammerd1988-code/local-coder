#!/usr/bin/env node
// One-command local run (Windows, macOS, Linux): installs deps, builds if
// needed, starts the production server on loopback and opens the browser.
//   npm run local            (PORT / LOCAL_CODER_PORT to change port, default 4000)
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.LOCAL_CODER_PORT || process.env.PORT || '4000';
// npm is a .cmd shim on Windows and needs a shell; node.exe must NOT go
// through one (its path usually contains spaces, e.g. C:\Program Files).
const run = (cmd, args) =>
  spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: cmd === 'npm' && process.platform === 'win32' });
const npm = 'npm';

if (run(process.execPath, [join(root, 'scripts/check-node-version.mjs')]).status !== 0) process.exit(1);

if (!existsSync(join(root, 'node_modules'))) {
  console.log('Installing dependencies...');
  if (run(npm, ['install', '--legacy-peer-deps']).status !== 0) process.exit(1);
}

const entries = ['dist/server/server/index.js', 'dist/server/index.js'].map((p) => join(root, p));
let entry = entries.find(existsSync);
if (!entry || process.argv.includes('--rebuild')) {
  console.log('Building...');
  if (run(npm, ['run', 'build']).status !== 0) process.exit(1);
  entry = entries.find(existsSync);
  if (!entry) { console.error('Build produced no server entry.'); process.exit(1); }
}

const url = `http://localhost:${port}/`;
const child = spawn(process.execPath, [entry], {
  cwd: join(root, 'dist'),
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production', PORT: port, DATA_DIRECTORY: process.env.DATA_DIRECTORY || join(root, 'data') },
});
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));

(async () => {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${url}api/health`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log(`\nLocal Coder running at ${url}  (Ctrl+C to stop)`);
  if (process.argv.includes('--no-open')) return;
  const [cmd, args] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
})();
