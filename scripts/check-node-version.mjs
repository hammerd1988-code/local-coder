import { pathToFileURL } from 'node:url';

export const minimumNodeVersion = '22.12.0';

export function supportsNodeVersion(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version);
  if (!match) return false;

  const current = match.slice(1).map(Number);
  const minimum = minimumNodeVersion.split('.').map(Number);

  for (let index = 0; index < minimum.length; index += 1) {
    if (current[index] !== minimum[index]) return current[index] > minimum[index];
  }
  return true;
}

function main() {
  const version = process.argv[2] ?? process.version;
  if (supportsNodeVersion(version)) return;

  console.error(`Local Code requires Node.js ${minimumNodeVersion} or newer; found ${version}.`);
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
