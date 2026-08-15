import { Kysely, SqliteDialect, Generated } from 'kysely';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

interface FilesTable {
  id: Generated<number>;
  path: string;
  content: string;
  language: string;
  created_at: number;
  updated_at: number;
}

interface ChatMessagesTable {
  id: Generated<number>;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: number;
}

interface SettingsTable {
  key: string;
  value: string;
  updated_at: number;
}

interface PluginsTable {
  id: Generated<number>;
  name: string;
  enabled: Generated<number>;
  config: Generated<string>;
  created_at: number;
  updated_at: number;
}

interface GitBranchesTable {
  id: Generated<number>;
  name: string;
  is_current: Generated<number>;
  last_commit: string | null;
  created_at: number;
}

interface GitStatusTable {
  id: number;
  status: string;
  updated_at: number;
}

interface HuggingFaceModelsTable {
  id: Generated<number>;
  model_id: string;
  model_name: string;
  model_type: string;
  size_mb: number | null;
  download_status: Generated<'pending' | 'downloading' | 'completed' | 'failed'>;
  download_progress: number | null;
  local_path: string | null;
  metadata: Generated<string>;
  downloaded_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface DatabaseSchema {
  files: FilesTable;
  chat_messages: ChatMessagesTable;
  settings: SettingsTable;
  plugins: PluginsTable;
  git_branches: GitBranchesTable;
  git_status: GitStatusTable;
  huggingface_models: HuggingFaceModelsTable;
}

const dataDirectory = process.env.DATA_DIRECTORY ?? "/home/app/data";
if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, { recursive: true });
}

const databasePath = path.join(dataDirectory, "database.sqlite");
console.log('Database path:', databasePath);

const sqliteDb = new Database(databasePath);

// Bootstrap the schema on fresh installs (idempotent).
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    content TEXT NOT NULL,
    language TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS plugins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    config TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS git_branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_current INTEGER NOT NULL DEFAULT 0,
    last_commit TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS git_status (
    id INTEGER PRIMARY KEY,
    status TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS huggingface_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    model_type TEXT NOT NULL,
    size_mb REAL,
    download_status TEXT NOT NULL DEFAULT 'pending',
    download_progress REAL,
    local_path TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    downloaded_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

export const db = new Kysely<DatabaseSchema>({
  dialect: new SqliteDialect({ database: sqliteDb }),
  log: ['query', 'error']
});
