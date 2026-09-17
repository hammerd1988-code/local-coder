import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('rejects an installed service that uses an unsupported Node runtime', { skip: process.platform === 'win32' }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'local-coder-launch-'));
  const systemctlLog = path.join(directory, 'systemctl.log');
  const startMarker = path.join(directory, 'service-started');
  const oldNode = path.join(directory, 'node-old');

  try {
    const commands = {
      curl: '#!/usr/bin/env bash\nexit 1\n',
      'notify-send': '#!/usr/bin/env bash\nexit 0\n',
      'node-old': '#!/usr/bin/env bash\nexit 1\n',
      systemctl: `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$SYSTEMCTL_LOG"
case "$*" in
  "--user show-environment") exit 0 ;;
  "--user list-unit-files local-coder.service --no-legend")
    echo "local-coder.service enabled"
    exit 0
    ;;
  "--user show local-coder.service --property=ExecStart --value")
    echo "{ path=$OLD_NODE ; argv[]=$OLD_NODE server.js ; }"
    exit 0
    ;;
  "--user start local-coder.service")
    touch "$START_MARKER"
    exit 0
    ;;
esac
exit 1
`,
    };

    await Promise.all(Object.entries(commands).map(async ([name, content]) => {
      const commandPath = path.join(directory, name);
      await writeFile(commandPath, content);
      await chmod(commandPath, 0o755);
    }));

    const result = spawnSync('bash', ['scripts/local-coder-launch.sh'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        LOCAL_CODER_PORT: '65534',
        OLD_NODE: oldNode,
        START_MARKER: startMarker,
        SYSTEMCTL_LOG: systemctlLog,
      },
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /installed service uses an unsupported Node runtime/i);
    assert.doesNotMatch(await readFile(systemctlLog, 'utf8'), /--user start/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
