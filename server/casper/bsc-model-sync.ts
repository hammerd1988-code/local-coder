import { db } from '../db.js';
import { getAccessToken, getRelayHttpBase, getRelayUrl } from './config.js';
import {
  getModelSettings,
  isOpenRouterUrl,
  modelSettingsFrom,
  normalizeBaseUrl,
  readSettings,
  settingEnvDefault,
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
  /** Whether BSC-V3 authenticates against this endpoint (local servers may not). */
  requiresKey: boolean;
}

export interface BscSyncSnapshot {
  provider: ModelProvider;
  model: string;
  baseUrl?: string;
  syncedAt: number;
}

const SNAPSHOT_KEY = 'bsc_model_sync';
const REFRESH_INTERVAL_MS = 5 * 60_000;
const FAILED_REFRESH_BACKOFF_MS = 30_000;
let nextRefreshAt = 0;
let inflightRefresh: Promise<RefreshResult> | null = null;

export type RefreshResult = 'refreshed' | 'unchanged' | 'not-following' | 'skipped' | 'failed';

export class BscSyncError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function readSetting(key: string): Promise<string | null> {
  const row = await db.selectFrom('settings').select('value').where('key', '=', key).executeTakeFirst();
  return row?.value ?? null;
}

type SettingsWriter = Pick<typeof db, 'insertInto' | 'deleteFrom' | 'selectFrom'>;

async function writeSetting(key: string, value: string, conn: SettingsWriter = db): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await conn.insertInto('settings')
    .values({ key, value, updated_at: now })
    .onConflict((oc) => oc.column('key').doUpdateSet({ value, updated_at: now }))
    .execute();
}

async function deleteSetting(key: string, conn: SettingsWriter = db): Promise<void> {
  await conn.deleteFrom('settings').where('key', '=', key).execute();
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

/**
 * Literal loopback / RFC1918 / link-local / CGNAT / ULA addresses and the
 * usual local hostnames. Hostnames that merely resolve to a private address
 * are treated as cloud endpoints (https + key required), which is the safer
 * default for something another machine told us to talk to.
 */
export function isPrivateHost(hostname: string): boolean {
  let h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.lan') || h.endsWith('.home.arpa')) return true;
  if (h === '::1' || h === '::') return true;
  if (h.startsWith('::ffff:')) h = h.slice(7);
  if (h.includes(':')) {
    return /^f[cd][0-9a-f]{2}:/.test(h) || /^fe[89ab][0-9a-f]:/.test(h);
  }
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0
    || a === 127
    || a === 10
    || (a === 192 && b === 168)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 169 && b === 254)
    || (a === 100 && b >= 64 && b <= 127);
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
    return { provider: 'lmstudio', model, baseUrl, keyField: 'lmstudio_api_key', requiresKey: settings.hasApiKey };
  }
  if (url.protocol !== 'https:') {
    throw new BscSyncError(`Refusing plaintext http endpoint ${url.host} for a cloud provider.`, 502);
  }
  if (isOpenRouterUrl(baseUrl)) return { provider: 'openrouter', model, keyField: 'openrouter_api_key', requiresKey: true };
  return { provider: 'openai', model, baseUrl, keyField: 'openai_api_key', requiresKey: true };
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
  await deleteSetting(SNAPSHOT_KEY);
}

function planBaseUrlField(plan: BscModelPlan): 'lmstudio_base_url' | 'openai_base_url' | null {
  if (plan.provider === 'lmstudio') return 'lmstudio_base_url';
  if (plan.provider === 'openai') return 'openai_base_url';
  return null;
}

/**
 * True when the plan points a keyed provider at a different server than the
 * one the stored key was entered for. The key must not follow the URL: a
 * changed endpoint (from BSC-V3, i.e. from another machine) would otherwise
 * receive a credential that was never meant for it.
 */
export function planMovesKeyedEndpoint(plan: BscModelPlan, settings: ModelSettings): boolean {
  if (!plan.baseUrl) return false;
  const current = currentBaseUrl(settings, plan.provider);
  return current !== undefined && current !== '' && current !== normalizeBaseUrl(plan.baseUrl);
}

export interface ApplyOptions {
  /**
   * Only write when the DB still matches this snapshot (or has none, when
   * `null`). Used by background refreshes so a manual change / Stop that
   * landed while BSC-V3 was being fetched wins.
   */
  expectSnapshot?: BscSyncSnapshot | null;
}

/**
 * Write the plan into Casper's model settings and remember it as the synced
 * state, in one transaction. Moving a keyed provider to a new endpoint drops
 * the stored key for that provider so it has to be re-entered for the new
 * server. Returns null when `expectSnapshot` no longer matches.
 */
export async function applyBscModelPlan(plan: BscModelPlan, opts: ApplyOptions = {}): Promise<BscSyncSnapshot | null> {
  return db.transaction().execute(async (trx) => {
    const get = await readSettings(trx);
    const settings = modelSettingsFrom(get);
    if (opts.expectSnapshot !== undefined) {
      const current = get(SNAPSHOT_KEY) ?? null;
      const expected = opts.expectSnapshot ? JSON.stringify(opts.expectSnapshot) : null;
      if (current !== expected || !isFollowing(settings, opts.expectSnapshot)) return null;
    }
    if (plan.keyField && plan.keyField !== 'openrouter_api_key' && planMovesKeyedEndpoint(plan, settings)) {
      await deleteSetting(plan.keyField, trx);
    }
    await writeSetting('model_provider', plan.provider, trx);
    await writeSetting('model_name', plan.model, trx);
    const field = planBaseUrlField(plan);
    if (field && plan.baseUrl) await writeSetting(field, plan.baseUrl, trx);
    const snapshot: BscSyncSnapshot = { provider: plan.provider, model: plan.model, syncedAt: Date.now() };
    if (plan.baseUrl) snapshot.baseUrl = plan.baseUrl;
    await writeSetting(SNAPSHOT_KEY, JSON.stringify(snapshot), trx);
    return snapshot;
  });
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

/**
 * Whether a usable local credential exists for the plan. A key stored for a
 * different endpoint of the same provider does not count (it gets dropped on
 * apply, see `applyBscModelPlan`).
 */
export async function hasKeyForPlan(plan: BscModelPlan, settings?: ModelSettings): Promise<boolean> {
  if (!plan.keyField || !plan.requiresKey) return true;
  const current = settings ?? (await getModelSettings());
  if (plan.keyField !== 'openrouter_api_key' && planMovesKeyedEndpoint(plan, current)) return false;
  return Boolean((await readSetting(plan.keyField))?.trim() || settingEnvDefault(plan.keyField));
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
export async function refreshBscModelIfFollowing(opts: { force?: boolean } = {}): Promise<RefreshResult> {
  const { following, snapshot } = await getBscSyncStatus();
  if (!following || !snapshot) return 'not-following';
  if (inflightRefresh) return inflightRefresh;
  if (!opts.force && Date.now() < nextRefreshAt) return 'skipped';
  inflightRefresh = doRefresh(snapshot).finally(() => {
    inflightRefresh = null;
  });
  return inflightRefresh;
}

async function doRefresh(snapshot: BscSyncSnapshot): Promise<RefreshResult> {
  try {
    const plan = planBscModel(await fetchBscAiSettings());
    nextRefreshAt = Date.now() + REFRESH_INTERVAL_MS;
    const same = snapshot.provider === plan.provider
      && snapshot.model === plan.model
      && (snapshot.baseUrl ? normalizeBaseUrl(snapshot.baseUrl) : undefined) === plan.baseUrl;
    if (same) return 'unchanged';
    const settings = await getModelSettings();
    if (plan.baseUrl && plan.baseUrl !== (snapshot.baseUrl ? normalizeBaseUrl(snapshot.baseUrl) : undefined)) {
      console.warn(`[casper:bsc-sync] BSC-V3 now points at a different endpoint (${plan.provider}); not switching automatically — use "Use BSC-V3 model" to accept it. Keeping ${settings.provider}/${settings.model}.`);
      return 'failed';
    }
    if (!(await hasKeyForPlan(plan, settings))) {
      console.warn(`[casper:bsc-sync] BSC-V3 moved to ${plan.provider}/${plan.model} but no local ${plan.keyField} is stored; keeping ${settings.provider}/${settings.model}.`);
      return 'failed';
    }
    const applied = await applyBscModelPlan(plan, { expectSnapshot: snapshot });
    if (!applied) {
      console.log('[casper:bsc-sync] settings changed while refreshing; left as-is');
      return 'not-following';
    }
    console.log(`[casper:bsc-sync] Following BSC-V3: ${plan.provider} / ${plan.model}`);
    return 'refreshed';
  } catch (err) {
    nextRefreshAt = Date.now() + FAILED_REFRESH_BACKOFF_MS;
    console.warn('[casper:bsc-sync] refresh skipped:', err instanceof Error ? err.message : String(err));
    return 'failed';
  }
}
