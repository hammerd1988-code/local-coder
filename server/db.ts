import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

interface FilesTable {
  id: number;
  path: string;
  content: string;
  language: string;
  created_at: number;
  updated_at: number;
}

interface ChatMessagesTable {
  id: number;
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
  id: number;
  name: string;
  enabled: number;
  config: string;
  created_at: number;
  updated_at: number;
}

interface GitBranchesTable {
  id: number;
  name: string;
  is_current: number;
  last_commit: string | null;
  created_at: number;
}

interface GitStatusTable {
  id: number;
  status: string;
  updated_at: number;
}

export interface DatabaseSchema {
  files: FilesTable;
  chat_messages: ChatMessagesTable;
  settings: SettingsTable;
  plugins: PluginsTable;
  git_branches: GitBranchesTable;
  git_status: GitStatusTable;
}

const dataDirectory = process.env.DATA_DIRECTORY ?? "/home/app/data";
if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, { recursive: true });
}

const databasePath = path.join(dataDirectory, "database.sqlite");
console.log('Database path:', databasePath);

const sqliteDb = new Database(databasePath);

export const db = new Kysely<DatabaseSchema>({
  dialect: new SqliteDialect({ database: sqliteDb }),
  log: ['query', 'error']
});
