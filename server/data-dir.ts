import path from 'path';
import fs from 'fs';

/**
 * Where the app keeps its SQLite database, cloned repos, and model downloads.
 *
 * `/home/app/data` is the container mount; outside the container it usually
 * isn't writable, so fall back to `./data` in the checkout. An explicit
 * DATA_DIRECTORY is always honoured as-is.
 */
function resolveDataDirectory(): string {
  const candidates = process.env.DATA_DIRECTORY
    ? [process.env.DATA_DIRECTORY]
    : ['/home/app/data', path.resolve(process.cwd(), 'data')];

  let lastError: unknown;
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`No writable data directory (tried ${candidates.join(', ')}): ${lastError}`);
}

export const DATA_DIRECTORY = resolveDataDirectory();
