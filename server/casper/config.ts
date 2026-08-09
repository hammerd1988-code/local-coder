import os from 'os';
import { randomUUID } from 'crypto';
import { db } from '../db.js';

const KEYS = {
  machineId: 'casper_machine_id',
  machineName: 'casper_machine_name',
  accessToken: 'casper_access_token',
  userId: 'casper_user_id',
  relayUrl: 'casper_relay_url',
  approvalLevel: 'casper_approval_level',
} as const;

async function get(key: string): Promise<string | null> {
  const row = await db.selectFrom('settings').select('value').where('key', '=', key).executeTakeFirst();
  const v = row?.value?.trim();
  return v || null;
}

async function set(key: string, value: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.insertInto('settings')
    .values({ key, value, updated_at: now })
    .onConflict((oc) => oc.column('key').doUpdateSet({ value, updated_at: now }))
    .execute();
}

async function del(key: string): Promise<void> {
  await db.deleteFrom('settings').where('key', '=', key).execute();
}

export async function ensureMachineIdentity(): Promise<{ machineId: string; machineName: string }> {
  let machineId = await get(KEYS.machineId);
  let machineName = await get(KEYS.machineName);
  if (!machineId) {
    machineId = randomUUID();
    await set(KEYS.machineId, machineId);
  }
  if (!machineName) {
    machineName = os.hostname() || 'local-code-machine';
    await set(KEYS.machineName, machineName);
  }
  return { machineId, machineName };
}

export async function getAccessToken(): Promise<string | null> {
  return get(KEYS.accessToken);
}

export async function setAccessToken(token: string, userId?: string): Promise<void> {
  await set(KEYS.accessToken, token);
  if (userId) await set(KEYS.userId, userId);
}

export async function clearAuth(): Promise<void> {
  await del(KEYS.accessToken);
  await del(KEYS.userId);
}

export async function getUserId(): Promise<string | null> {
  return get(KEYS.userId);
}

export async function getRelayUrl(): Promise<string> {
  return (await get(KEYS.relayUrl)) || 'https://bloodsweatcode.org';
}

export async function setRelayUrl(url: string): Promise<void> {
  await set(KEYS.relayUrl, url.trim());
}

export async function getApprovalLevel(): Promise<'auto' | 'confirm-remote'> {
  const v = await get(KEYS.approvalLevel);
  return v === 'auto' ? 'auto' : 'confirm-remote';
}

export function getRelayHttpBase(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    url = new URL('https://bloodsweatcode.org');
  }
  const protocol = url.protocol === 'ws:' ? 'http:' : url.protocol === 'wss:' ? 'https:' : url.protocol;
  return `${protocol}//${url.host}`;
}

export const CASPER_HOME_VERSION = 'local-code-0.1.0';
