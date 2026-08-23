import { db } from './db.js';

// Blood Sweat Code license link. A key minted at bloodsweatcode.org (Settings →
// Subscription → Local Coder License) is stored in the sqlite `settings` table
// and verified against the BSC API to resolve the owner's subscription tier.

export type LicenseTier = 'indie' | 'operator' | 'architect';

export interface LicenseStatus {
  linked: boolean;
  valid: boolean;
  tier: LicenseTier;
  hostedAi: boolean;
  /** Max remote NEO//OPS nodes; null = unlimited. */
  remoteNodeLimit: number | null;
  error?: string;
}

const DEFAULT_BSC_API_URL = 'https://bloodsweatcode.org';
const CACHE_TTL_MS = 5 * 60 * 1000;

const UNLINKED: LicenseStatus = {
  linked: false,
  valid: false,
  tier: 'indie',
  hostedAi: false,
  remoteNodeLimit: 0,
};

let cached: { status: LicenseStatus; at: number } | null = null;

export function invalidateLicenseCache(): void {
  cached = null;
}

async function readSetting(key: string): Promise<string | null> {
  const row = await db.selectFrom('settings')
    .select('value')
    .where('key', '=', key)
    .executeTakeFirst();
  return row?.value ?? null;
}

export async function getLicenseStatus(): Promise<LicenseStatus> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.status;

  const key = await readSetting('bsc_license_key');
  if (!key) {
    cached = { status: UNLINKED, at: Date.now() };
    return UNLINKED;
  }

  const baseUrl = (await readSetting('bsc_api_url')) || DEFAULT_BSC_API_URL;

  let status: LicenseStatus;
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/license/verify`, {
      headers: { 'x-license-key': key },
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.valid) {
      status = {
        linked: true,
        valid: true,
        tier: data.tier as LicenseTier,
        hostedAi: Boolean(data.features?.hostedAi),
        remoteNodeLimit:
          data.features?.remoteNodeLimit === null || typeof data.features?.remoteNodeLimit === 'number'
            ? data.features.remoteNodeLimit
            : 0,
      };
    } else {
      status = { ...UNLINKED, linked: true, error: data.error || `Verification failed (${res.status})` };
    }
  } catch (err) {
    // Network failure: keep the last known status if we have one so a BSC
    // outage doesn't lock users out of already-verified features.
    if (cached) return cached.status;
    status = { ...UNLINKED, linked: true, error: err instanceof Error ? err.message : String(err) };
  }

  cached = { status, at: Date.now() };
  return status;
}
