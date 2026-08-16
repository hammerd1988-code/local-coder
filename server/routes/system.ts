import { Router } from 'express';
import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';

const router = Router();

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function run(cmd: string, args: string[], timeoutMs = 10_000): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      const code = err && typeof (err as any).code === 'number' ? (err as any).code : err ? 1 : 0;
      resolve({ stdout: stdout?.toString() ?? '', stderr: stderr?.toString() ?? '', code });
    });
  });
}

async function readProc(file: string): Promise<string> {
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// CPU / memory / network sampling
// ---------------------------------------------------------------------------

interface CpuTimes { total: number; idle: number }

async function sampleCpu(): Promise<{ aggregate: CpuTimes; cores: CpuTimes[] }> {
  const stat = await readProc('/proc/stat');
  const cores: CpuTimes[] = [];
  let aggregate: CpuTimes = { total: 0, idle: 0 };
  for (const line of stat.split('\n')) {
    if (!line.startsWith('cpu')) continue;
    const parts = line.trim().split(/\s+/);
    const label = parts[0];
    const nums = parts.slice(1).map((n) => parseInt(n, 10) || 0);
    const idle = nums[3] + (nums[4] || 0); // idle + iowait
    const total = nums.reduce((a, b) => a + b, 0);
    if (label === 'cpu') aggregate = { total, idle };
    else cores.push({ total, idle });
  }
  return { aggregate, cores };
}

function cpuPercent(prev: CpuTimes, cur: CpuTimes): number {
  const dTotal = cur.total - prev.total;
  const dIdle = cur.idle - prev.idle;
  if (dTotal <= 0) return 0;
  return Math.min(100, Math.max(0, ((dTotal - dIdle) / dTotal) * 100));
}

async function sampleMemory() {
  const meminfo = await readProc('/proc/meminfo');
  const get = (key: string) => {
    const m = meminfo.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'));
    return m ? parseInt(m[1], 10) * 1024 : 0;
  };
  const total = get('MemTotal');
  const available = get('MemAvailable');
  return {
    total,
    used: total - available,
    available,
    cached: get('Cached'),
    buffers: get('Buffers'),
    swapTotal: get('SwapTotal'),
    swapUsed: get('SwapTotal') - get('SwapFree'),
  };
}

interface NetSample { rx: number; tx: number }

async function sampleNet(): Promise<Record<string, NetSample>> {
  const dev = await readProc('/proc/net/dev');
  const out: Record<string, NetSample> = {};
  for (const line of dev.split('\n').slice(2)) {
    const m = line.match(/^\s*([^:]+):\s*(.*)$/);
    if (!m) continue;
    const iface = m[1].trim();
    const nums = m[2].trim().split(/\s+/).map((n) => parseInt(n, 10) || 0);
    out[iface] = { rx: nums[0], tx: nums[8] };
  }
  return out;
}

async function sampleDiskIo(): Promise<{ read: number; write: number }> {
  const stats = await readProc('/proc/diskstats');
  let read = 0;
  let write = 0;
  for (const line of stats.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 14) continue;
    const name = parts[2];
    // whole devices only (skip partitions/loop/ram)
    if (/^(loop|ram|dm-)/.test(name) || /\d+p?\d+$/.test(name)) continue;
    read += (parseInt(parts[5], 10) || 0) * 512;
    write += (parseInt(parts[9], 10) || 0) * 512;
  }
  return { read, write };
}

// ---------------------------------------------------------------------------
// GET /api/system/overview — static-ish host identity info
// ---------------------------------------------------------------------------

router.get('/overview', async (_req, res) => {
  try {
    const osRelease = await readProc('/etc/os-release');
    const pretty = osRelease.match(/^PRETTY_NAME="?([^"\n]+)"?/m)?.[1] ?? 'Linux';
    const uptimeRaw = await readProc('/proc/uptime');
    const uptime = parseFloat(uptimeRaw.split(' ')[0]) || os.uptime();
    const cpus = os.cpus();
    const mem = await sampleMemory();

    const addresses: { iface: string; address: string; family: string }[] = [];
    for (const [iface, addrs] of Object.entries(os.networkInterfaces())) {
      for (const a of addrs ?? []) {
        if (!a.internal) addresses.push({ iface, address: a.address, family: a.family });
      }
    }

    res.json({
      hostname: os.hostname(),
      distro: pretty,
      kernel: os.release(),
      arch: os.arch(),
      uptime,
      bootTime: Date.now() - uptime * 1000,
      loadavg: os.loadavg(),
      cpu: { model: cpus[0]?.model ?? 'unknown', cores: cpus.length, speedMHz: cpus[0]?.speed ?? 0 },
      memory: mem,
      addresses,
      user: os.userInfo().username,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/system/stream — SSE live telemetry
// ---------------------------------------------------------------------------

router.get('/stream', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(':ok\n\n');

  let prevCpu = await sampleCpu();
  let prevNet = await sampleNet();
  let prevIo = await sampleDiskIo();
  let prevTime = Date.now();

  const INTERVAL = 1500;
  const timer = setInterval(async () => {
    try {
      const now = Date.now();
      const dt = (now - prevTime) / 1000;
      const cpu = await sampleCpu();
      const net = await sampleNet();
      const io = await sampleDiskIo();
      const mem = await sampleMemory();

      let rxRate = 0;
      let txRate = 0;
      for (const [iface, cur] of Object.entries(net)) {
        if (iface === 'lo') continue;
        const prev = prevNet[iface];
        if (!prev) continue;
        rxRate += Math.max(0, cur.rx - prev.rx) / dt;
        txRate += Math.max(0, cur.tx - prev.tx) / dt;
      }

      const payload = {
        t: now,
        cpu: cpuPercent(prevCpu.aggregate, cpu.aggregate),
        cores: cpu.cores.map((c, i) => cpuPercent(prevCpu.cores[i] ?? c, c)),
        mem,
        net: { rx: rxRate, tx: txRate },
        io: {
          read: Math.max(0, io.read - prevIo.read) / dt,
          write: Math.max(0, io.write - prevIo.write) / dt,
        },
        loadavg: os.loadavg(),
        uptime: os.uptime(),
        procs: undefined as number | undefined,
      };
      try {
        const dirs = await fs.readdir('/proc');
        payload.procs = dirs.filter((d) => /^\d+$/.test(d)).length;
      } catch { /* /proc unavailable */ }

      prevCpu = cpu;
      prevNet = net;
      prevIo = io;
      prevTime = now;
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {
      // keep the stream alive; next tick may succeed
    }
  }, INTERVAL);

  req.on('close', () => clearInterval(timer));
});

// ---------------------------------------------------------------------------
// GET /api/system/processes — process table
// ---------------------------------------------------------------------------

router.get('/processes', async (_req, res) => {
  const { stdout, code, stderr } = await run('ps', ['-eo', 'pid,ppid,user:20,pcpu,pmem,rss,stat,etime,nice,args', '--sort=-pcpu', '--no-headers']);
  if (code !== 0) {
    res.status(500).json({ error: stderr || 'ps failed' });
    return;
  }
  const processes = stdout
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      const [pid, ppid, user, cpu, mem, rss, stat, etime, nice] = parts;
      return {
        pid: parseInt(pid, 10),
        ppid: parseInt(ppid, 10),
        user,
        cpu: parseFloat(cpu),
        mem: parseFloat(mem),
        rss: (parseInt(rss, 10) || 0) * 1024,
        stat,
        etime,
        nice,
        command: parts.slice(9).join(' '),
      };
    })
    .filter((p) => Number.isFinite(p.pid));
  res.json({ processes });
});

const ALLOWED_SIGNALS = new Set(['SIGTERM', 'SIGKILL', 'SIGHUP', 'SIGINT', 'SIGSTOP', 'SIGCONT']);

router.post('/processes/:pid/signal', async (req, res) => {
  const pid = parseInt(req.params.pid, 10);
  const signal = String(req.body?.signal ?? 'SIGTERM');
  if (!Number.isFinite(pid) || pid <= 1) {
    res.status(400).json({ error: 'Invalid pid' });
    return;
  }
  if (!ALLOWED_SIGNALS.has(signal)) {
    res.status(400).json({ error: 'Signal not allowed' });
    return;
  }
  try {
    process.kill(pid, signal as NodeJS.Signals);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? String(err) });
  }
});

// ---------------------------------------------------------------------------
// Services (systemd, with graceful fallback)
// ---------------------------------------------------------------------------

router.get('/services', async (_req, res) => {
  const probe = await run('systemctl', ['is-system-running'], 5000);
  const systemdUp = probe.stdout.trim().length > 0 && !/offline/.test(probe.stdout);
  if (!systemdUp) {
    // Fallback for containers without systemd: sysv-style listing
    const sysv = await run('service', ['--status-all'], 8000);
    if (sysv.stdout.trim()) {
      const services = sysv.stdout
        .split('\n')
        .map((l) => l.match(/\[\s*([+\-?])\s*\]\s+(\S+)/))
        .filter(Boolean)
        .map((m) => ({
          name: m![2],
          description: '',
          load: 'sysv',
          active: m![1] === '+' ? 'active' : m![1] === '-' ? 'inactive' : 'unknown',
          sub: m![1] === '+' ? 'running' : 'stopped',
        }));
      res.json({ manager: 'sysv', services });
      return;
    }
    res.json({ manager: 'none', services: [] });
    return;
  }

  const { stdout } = await run('systemctl', ['list-units', '--type=service', '--all', '--no-legend', '--plain', '--no-pager']);
  const services = stdout
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      const [unit, load, active, sub] = parts;
      return {
        name: unit?.replace(/\.service$/, '') ?? '',
        load,
        active,
        sub,
        description: parts.slice(4).join(' '),
      };
    })
    .filter((s) => s.name);
  res.json({ manager: 'systemd', services });
});

const SERVICE_ACTIONS = new Set(['start', 'stop', 'restart', 'reload']);
const SERVICE_NAME_RE = /^[A-Za-z0-9_.@:-]+$/;

router.post('/services/:name/:action', async (req, res) => {
  const { name, action } = req.params;
  if (!SERVICE_ACTIONS.has(action) || !SERVICE_NAME_RE.test(name)) {
    res.status(400).json({ error: 'Invalid service or action' });
    return;
  }
  let result = await run('systemctl', [action, `${name}.service`], 30_000);
  if (result.code !== 0) {
    // sysv fallback
    result = await run('service', [name, action], 30_000);
  }
  if (result.code !== 0) {
    res.status(500).json({ error: (result.stderr || result.stdout || 'command failed').trim() });
    return;
  }
  res.json({ ok: true, output: (result.stdout + result.stderr).trim() });
});

// ---------------------------------------------------------------------------
// Network — interfaces + sockets
// ---------------------------------------------------------------------------

interface SocketRow {
  proto: string;
  state: string;
  local: string;
  peer: string;
  process: string;
}

function parseSs(stdout: string): SocketRow[] {
  return stdout
    .split('\n')
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      const [proto, state, , , local, peer] = parts;
      const proc = line.match(/users:\(\("([^"]+)",pid=(\d+)/);
      return {
        proto,
        state,
        local,
        peer,
        process: proc ? `${proc[1]} (${proc[2]})` : '',
      };
    })
    .filter((s) => s.proto && s.local);
}

function parseNetstat(stdout: string): SocketRow[] {
  return stdout
    .split('\n')
    .filter((l) => /^(tcp|udp)/.test(l.trim()))
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      const proto = parts[0];
      // netstat omits the State column on UDP rows, shifting PID/Program left.
      const isUdp = proto.startsWith('udp');
      const program = isUdp ? parts[5] : parts[6];
      const proc = program ? program.match(/^(\d+)\/(.+)$/) : null;
      return {
        proto,
        state: isUdp ? '' : parts[5] ?? '',
        local: parts[3] ?? '',
        peer: parts[4] ?? '',
        process: proc ? `${proc[2]} (${proc[1]})` : '',
      };
    })
    .filter((s) => s.proto && s.local);
}

// Prefer iproute2, but minimal images often ship only net-tools (or neither),
// in which case an unhandled failure would render the panel silently empty.
async function listSockets(): Promise<SocketRow[]> {
  let ss = await run('ss', ['-tulpn'], 8000);
  if (ss.code !== 0) ss = await run('ss', ['-tuln'], 8000);
  if (ss.code === 0 && ss.stdout.trim()) return parseSs(ss.stdout);

  let ns = await run('netstat', ['-tulpn'], 8000);
  if (ns.code !== 0) ns = await run('netstat', ['-tuln'], 8000);
  if (ns.code === 0 && ns.stdout.trim()) return parseNetstat(ns.stdout);

  return [];
}

router.get('/network', async (_req, res) => {
  const counters = await sampleNet();
  const interfaces = Object.entries(os.networkInterfaces()).map(([name, addrs]) => ({
    name,
    addresses: (addrs ?? []).map((a) => ({ address: a.address, family: a.family, internal: a.internal, mac: a.mac })),
    rxBytes: counters[name]?.rx ?? 0,
    txBytes: counters[name]?.tx ?? 0,
  }));

  const sockets = await listSockets();
  res.json({ interfaces, sockets });
});

// ---------------------------------------------------------------------------
// Disks
// ---------------------------------------------------------------------------

router.get('/disks', async (_req, res) => {
  const { stdout, code } = await run('df', ['-kP', '-x', 'tmpfs', '-x', 'devtmpfs', '-x', 'overlay2']);
  if (code !== 0) {
    res.json({ disks: [] });
    return;
  }
  const disks = stdout
    .split('\n')
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      const [fsName, blocks, used, avail, pct] = parts;
      return {
        filesystem: fsName,
        size: (parseInt(blocks, 10) || 0) * 1024,
        used: (parseInt(used, 10) || 0) * 1024,
        available: (parseInt(avail, 10) || 0) * 1024,
        usePercent: parseInt(pct, 10) || 0,
        mount: parts.slice(5).join(' '),
      };
    })
    .filter((d) => d.filesystem && d.filesystem !== 'none');
  res.json({ disks });
});

// ---------------------------------------------------------------------------
// Logs — list & tail files under /var/log (+ dmesg / journalctl)
// ---------------------------------------------------------------------------

const LOG_ROOT = '/var/log';

router.get('/logs', async (_req, res) => {
  const files: { name: string; path: string; size: number; mtime: number }[] = [];
  async function walk(dir: string, depth: number) {
    if (depth > 2) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) await walk(full, depth + 1);
      else if (e.isFile() && !/\.(gz|xz|zst|[0-9]+)$/.test(e.name)) {
        try {
          const st = await fs.stat(full);
          files.push({ name: full.slice(LOG_ROOT.length + 1), path: full, size: st.size, mtime: st.mtimeMs });
        } catch { /* unreadable */ }
      }
    }
  }
  await walk(LOG_ROOT, 0);
  files.sort((a, b) => b.mtime - a.mtime);

  const sources: string[] = [];
  if ((await run('journalctl', ['--no-pager', '-n', '1'], 5000)).code === 0) sources.push('journalctl');
  if ((await run('dmesg', ['-T'], 5000)).code === 0) sources.push('dmesg');
  res.json({ files, sources });
});

router.get('/logs/tail', async (req, res) => {
  const source = String(req.query.source ?? '');
  const lines = Math.min(2000, Math.max(10, parseInt(String(req.query.lines ?? '200'), 10) || 200));

  if (source === 'journalctl') {
    const r = await run('journalctl', ['--no-pager', '-n', String(lines)], 10_000);
    res.json({ content: r.stdout || r.stderr });
    return;
  }
  if (source === 'dmesg') {
    const r = await run('dmesg', ['-T'], 10_000);
    const all = r.stdout.split('\n');
    res.json({ content: all.slice(-lines).join('\n') });
    return;
  }

  const filePath = String(req.query.path ?? '');
  const resolved = filePath.startsWith('/') ? filePath : `${LOG_ROOT}/${filePath}`;
  if (!resolved.startsWith(LOG_ROOT + '/')) {
    res.status(400).json({ error: 'Log path must be under /var/log' });
    return;
  }
  try {
    const st = await fs.stat(resolved);
    const CHUNK = 512 * 1024;
    const start = Math.max(0, st.size - CHUNK);
    const fh = await fs.open(resolved, 'r');
    try {
      const buf = Buffer.alloc(st.size - start);
      await fh.read(buf, 0, buf.length, start);
      const text = buf.toString('utf8');
      const allLines = text.split('\n');
      res.json({ content: allLines.slice(-lines).join('\n'), size: st.size });
    } finally {
      await fh.close();
    }
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? String(err) });
  }
});

export default router;
