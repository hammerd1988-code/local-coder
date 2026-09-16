import { db } from '../db.js';
import { getAccessToken, getRelayHttpBase, getRelayUrl } from './config.js';
import {
  getModelSettings,
  isOpenRouterUrl,
  normalizeBaseUrl,
  type ModelProvider,
  type ModelSettings,
} from '../model-provider.js';

/** Non-secret AI Core settings BSC-V3 returns for the linked account. */
export interface BscAiSettings {
  model: string;
  endpoint: string;
  modelSource: 'user' | 'platform';
  endpointSource: 'user' | 'platform';
  hasApiKey: boolean;
}

/** What Casper's model settings look like when they mirror BSC-V3. */
export interface BscModelPlan {
  provider: ModelProvider;
  model: string;
  /** Provider root (no `/v1`); unset for OpenRouter, whose URL is fixed. */
  baseUrl?: string;
  /** Settings key holding the credential this provider needs (none for local). */
  keyField: 'openrouter_api_key' | 'openai_api_key' | 'lmstudio_api_key' | null;
}

export interface BscSyncSnapshot {
  provider: ModelProvider;
  model: string;
  baseUrl?: string;
  syncedAt: number;
}

const SNAPSHOT_KEY = 'bsc_model_sync';
const REFRESH_INTERVAL_MS = 5 * 60_000;
let lastRefreshAt = 0;

export class BscSyncError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function readSetting(key: string): Promise<string | null> {
  const row = await db.selectFrom('settings').select('value').where('key', '=', key).executeTakeFirst();
  return row?.value ?? null;
}

async function writeSetting(key: string, value: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.insertInto('settings')
    .values({ key, value, updated_at: now })
    .onConflict((oc) => oc.column('key').doUpdateSet({ value, updated_at: now }))
    .execute();
}

export async function fetchBscAiSettings(): Promise<BscAiSettings> {
  const token = await getAccessToken();
  if (!token) throw new BscSyncError('Link this machine to BSC-V3 first (Casper panel → Link).', 401);
  const base = getRelayHttpBase(await getRelayUrl());
  let response: Response;
  try {
    response = await fetch(`${base}/api/casper/user/ai-settings`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    throw new BscSyncError(`Could not reach BSC-V3: ${err instanceof Error ? err.message : String(err)}`, 502);
  }
  const data = (await response.json().catch(() => ({}))) as Partial<BscAiSettings> & { success?: boolean; error?: string };
  if (!response.ok || !data.success) {
    throw new BscSyncError(data.error || `BSC-V3 returned ${response.status}`, response.status || 502);
  }
  if (typeof data.model !== 'string' || typeof data.endpoint !== 'string') {
    throw new BscSyncError('BSC-V3 returned an incomplete AI settings payload.', 502);
  }
  return {
    model: data.model,
    endpoint: data.endpoint,
    modelSource: data.modelSource === 'user' ? 'user' : 'platform',
    endpointSource: data.endpointSource === 'user' ? 'user' : 'platform',
    hasApiKey: Boolean(data.hasApiKey),
  };
}

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h === '::1' || h.endsWith('.local') || h.endsWith('.localhost')) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

export function planBscModel(settings: BscAiSettings): BscModelPlan {
  const model = settings.model.trim();
  if (!model) throw new BscSyncError('BSC-V3 returned no model.', 502);
  let url: URL;
  try {
    url = new URL(settings.endpoint);
  } catch {
    throw new BscSyncError(`BSC-V3 endpoint "${settings.endpoint}" is not a valid URL.`, 502);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BscSyncError(`BSC-V3 endpoint must be http(s), got ${url.protocol}`, 502);
  }
  const baseUrl = normalizeBaseUrl(settings.endpoint);
  if (isPrivateHost(url.hostname)) {
    return { provider: 'lmstudio', model, baseUrl, keyField: 'lmstudio_api_key' };
  }
  if (url.protocol !== 'https:') {
    throw new BscSyncError(`Refusing plaintext http endpoint ${url.host} for a cloud provider.`, 502);
  }
  if (isOpenRouterUrl(baseUrl)) return { provider: 'openrouter', model, keyField: 'openrouter_api_key' };
  return { provider: 'openai', model, baseUrl, keyField: 'openai_api_key' };
}

export async function getSnapshot(): Promise<BscSyncSnapshot | null> {
  const raw = await readSetting(SNAPSHOT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BscSyncSnapshot>;
    if (typeof parsed.model !== 'string' || typeof parsed.provider !== 'string') return null;
    return {
      provider: parsed.provider as ModelProvider,
      model: parsed.model,
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : undefined,
      syncedAt: typeof parsed.syncedAt === 'number' ? parsed.syncedAt : 0,
    };
  } catch {
    return null;
  }
}

export async function clearSnapshot(): Promise<void> {
  await db.deleteFrom('settings').where('key', '=', SNAPSHOT_KEY).execute();
}

function planBaseUrlField(plan: BscModelPlan): 'lmstudio_base_url' | 'openai_base_url' | null {
  if (plan.provider === 'lmstudio') return 'lmstudio_base_url';
  if (plan.provider === 'openai') return 'openai_base_url';
  return null;
}

/** Write the plan into Casper's model settings and remember it as the synced state. */
export async function applyBscModelPlan(plan: BscModelPlan): Promise<BscSyncSnapshot> {
  await writeSetting('model_provider', plan.provider);
  await writeSetting('model_name', plan.model);
  const field = planBaseUrlField(plan);
  if (field && plan.baseUrl) await writeSetting(field, plan.baseUrl);
  const snapshot: BscSyncSnapshot = { provider: plan.provider, model: plan.model, syncedAt: Date.now() };
  if (plan.baseUrl) snapshot.baseUrl = plan.baseUrl;
  await writeSetting(SNAPSHOT_KEY, JSON.stringify(snapshot));
  return snapshot;
}

function currentBaseUrl(settings: ModelSettings, provider: ModelProvider): string | undefined {
  if (provider === 'lmstudio') return normalizeBaseUrl(settings.lmstudioBaseUrl);
  if (provider === 'openai') return normalizeBaseUrl(settings.openaiBaseUrl);
  return undefined;
}

/** True while the local model settings still equal what was last synced from BSC-V3. */
export function isFollowing(settings: ModelSettings, snapshot: BscSyncSnapshot | null): boolean {
  if (!snapshot) return false;
  if (settings.provider !== snapshot.provider || settings.model !== snapshot.model) return false;
  const base = currentBaseUrl(settings, snapshot.provider);
  return (base ?? undefined) === (snapshot.baseUrl ? normalizeBaseUrl(snapshot.baseUrl) : undefined);
}

export async function hasKeyForPlan(plan: BscModelPlan): Promise<boolean> {
  if (!plan.keyField) return true;
  if (plan.keyField === 'lmstudio_api_key') return true;
  return Boolean((await readSetting(plan.keyField))?.trim());
}

export interface BscSyncStatus {
  following: boolean;
  snapshot: BscSyncSnapshot | null;
}

export async function getBscSyncStatus(): Promise<BscSyncStatus> {
  const [settings, snapshot] = await Promise.all([getModelSettings(), getSnapshot()]);
  return { following: isFollowing(settings, snapshot), snapshot };
}

/**
 * Re-pull the BSC-V3 model if Casper is following it and the last check is
 * stale. Any failure (offline, unlinked, 409, 5xx) keeps the current working
 * settings — it never downgrades a configured Casper.
 */
export async function refreshBscModelIfFollowing(opts: { force?: boolean } = {}): Promise<'refreshed' | 'unchanged' | 'not-following' | 'skipped' | 'failed'> {
  const { following } = await getBscSyncStatus();
  if (!following) return 'not-following';
  if (!opts.force && Date.now() - lastRefreshAt < REFRESH_INTERVAL_MS) return 'skipped';
  lastRefreshAt = Date.now();
  try {
    const plan = planBscModel(await fetchBscAiSettings());
    const settings = await getModelSettings();
    const snapshot = await getSnapshot();
    const same = snapshot
      && snapshot.provider === plan.provider
      && snapshot.model === plan.model
      && (snapshot.baseUrl ? normalizeBaseUrl(snapshot.baseUrl) : undefined) === plan.baseUrl;
    if (same) return 'unchanged';
    if (!(await hasKeyForPlan(plan))) {
      console.warn(`[casper:bsc-sync] BSC-V3 moved to ${plan.provider}/${plan.model} but no local ${plan.keyField} is stored; keeping ${settings.provider}/${settings.model}.`);
      return 'failed';
    }
    await applyBscModelPlan(plan);
    console.log(`[casper:bsc-sync] Following BSC-V3: ${plan.provider} / ${plan.model}`);
    return 'refreshed';
  } catch (err) {
    console.warn('[casper:bsc-sync] refresh skipped:', err instanceof Error ? err.message : String(err));
    return 'failed';
  }
}
