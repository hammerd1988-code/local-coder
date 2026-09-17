import { db } from './db.js';
import { isAutoModel, resolveModel } from './model-resolver.js';

/**
 * Model providers Casper can run on. `lmstudio`, `openrouter` and `openai`
 * all speak the OpenAI chat-completions API; `ollama` has its own streaming
 * API for chat but exposes /v1 for the tool loop.
 */
export type ModelProvider = 'lmstudio' | 'ollama' | 'openrouter' | 'openai';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api';

export const PROVIDER_LABELS: Record<ModelProvider, string> = {
  lmstudio: 'LM Studio',
  ollama: 'Ollama',
  openrouter: 'OpenRouter',
  openai: 'OpenAI-compatible',
};

export interface ModelSettings {
  provider: ModelProvider;
  model: string;
  ollamaBaseUrl: string;
  lmstudioBaseUrl: string;
  lmstudioApiKey: string;
  openrouterApiKey: string;
  openaiBaseUrl: string;
  openaiApiKey: string;
}

export function normalizeProvider(value: string | undefined | null): ModelProvider {
  const normalized = (value ?? '').trim().toLowerCase();
  switch (normalized) {
    case 'ollama':
    case 'openrouter':
    case 'openai':
      return normalized;
    default:
      return 'lmstudio';
  }
}

export function isCloudProvider(provider: ModelProvider): boolean {
  return provider === 'openrouter' || provider === 'openai';
}

export function isOpenRouterUrl(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase() === 'openrouter.ai';
  } catch {
    return false;
  }
}

/** Strip a trailing slash and a trailing `/v1` so both forms of a base URL work. */
export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '').replace(/\/v1$/, '');
}

export type SettingsReader = Pick<typeof db, 'selectFrom'>;

/**
 * Environment fallbacks for model settings, used when the settings table has
 * no value for a key. Lets hosted deployments (Railway) be configured from
 * variables without a persistent data volume or a first visit to the UI.
 */
export const SETTING_ENV_DEFAULTS: Record<string, string> = {
  model_provider: 'MODEL_PROVIDER',
  model_name: 'MODEL_NAME',
  ollama_base_url: 'OLLAMA_BASE_URL',
  lmstudio_base_url: 'LMSTUDIO_BASE_URL',
  lmstudio_api_key: 'LMSTUDIO_API_KEY',
  openrouter_api_key: 'OPENROUTER_API_KEY',
  openai_base_url: 'OPENAI_BASE_URL',
  openai_api_key: 'OPENAI_API_KEY',
};

export function settingEnvDefault(key: string): string | undefined {
  const envName = SETTING_ENV_DEFAULTS[key];
  const value = envName ? process.env[envName]?.trim() : undefined;
  return value || undefined;
}

export async function readSettings(conn: SettingsReader = db): Promise<(key: string) => string | undefined> {
  const rows = await conn.selectFrom('settings').select(['key', 'value']).execute();
  const values = new Map(rows.map((r) => [r.key, r.value?.trim()] as const));
  return (key: string) => values.get(key) || settingEnvDefault(key);
}

export async function getModelSettings(conn: SettingsReader = db): Promise<ModelSettings> {
  return modelSettingsFrom(await readSettings(conn));
}

export function modelSettingsFrom(get: (key: string) => string | undefined): ModelSettings {
  return {
    provider: normalizeProvider(get('model_provider')),
    model: (get('model_name') || '').trim(),
    ollamaBaseUrl: get('ollama_base_url') || 'http://localhost:11434',
    lmstudioBaseUrl: get('lmstudio_base_url') || 'http://localhost:1234',
    lmstudioApiKey: get('lmstudio_api_key') || '',
    openrouterApiKey: get('openrouter_api_key') || '',
    openaiBaseUrl: get('openai_base_url') || '',
    openaiApiKey: get('openai_api_key') || '',
  };
}

export interface CompletionTarget {
  provider: ModelProvider;
  /** Provider root without `/v1` (e.g. `http://localhost:1234`, `https://openrouter.ai/api`). */
  baseUrl: string;
  /** OpenAI-compatible root, i.e. `${baseUrl}/v1`. */
  openAiBase: string;
  apiKey: string;
  /** Resolved model id, or undefined when the provider should pick (auto). */
  model: string | undefined;
  /** Extra headers the provider wants on every request. */
  headers: Record<string, string>;
}

export function providerBaseUrl(settings: ModelSettings): string {
  switch (settings.provider) {
    case 'ollama':
      return normalizeBaseUrl(settings.ollamaBaseUrl);
    case 'openrouter':
      return OPENROUTER_BASE_URL;
    case 'openai':
      return normalizeBaseUrl(settings.openaiBaseUrl);
    default:
      return normalizeBaseUrl(settings.lmstudioBaseUrl);
  }
}

export function providerApiKey(settings: ModelSettings): string {
  switch (settings.provider) {
    case 'ollama':
      return '';
    case 'openrouter':
      return settings.openrouterApiKey.trim();
    case 'openai':
      return settings.openaiApiKey.trim();
    default:
      return settings.lmstudioApiKey.trim();
  }
}

/** Validate a cloud provider is usable before we send a directive at it. */
export function assertProviderReady(settings: ModelSettings): void {
  if (settings.provider === 'openrouter' && !settings.openrouterApiKey.trim()) {
    throw new Error('OpenRouter needs an API key — add it in Casper settings (keys are stored on this machine only).');
  }
  if (settings.provider === 'openai') {
    if (!settings.openaiBaseUrl.trim()) throw new Error('Set the OpenAI-compatible base URL in Casper settings.');
    if (!settings.openaiApiKey.trim()) throw new Error('The OpenAI-compatible provider needs an API key — add it in Casper settings.');
  }
  if (isCloudProvider(settings.provider) && isAutoModel(settings.model)) {
    throw new Error(`Pick a model for ${PROVIDER_LABELS[settings.provider]} in Casper settings (cloud providers have no "auto" model).`);
  }
}

export async function resolveCompletionTarget(
  settings: ModelSettings,
  requestedModel?: string | null,
): Promise<CompletionTarget> {
  assertProviderReady(settings);
  const baseUrl = providerBaseUrl(settings);
  const apiKey = providerApiKey(settings);
  // Cloud providers have no "whatever is loaded" model: a per-request `auto`
  // falls back to the configured model instead of probing the provider.
  const requested = (requestedModel ?? '').trim();
  const configured = requested && !(isCloudProvider(settings.provider) && isAutoModel(requested))
    ? requested
    : settings.model;
  const model = await resolveModel(settings.provider, configured, baseUrl, apiKey);
  const headers: Record<string, string> = {};
  if (settings.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://bloodsweatcode.org';
    headers['X-Title'] = 'Local Coder (Casper)';
  }
  return { provider: settings.provider, baseUrl, openAiBase: `${baseUrl}/v1`, apiKey, model, headers };
}

/** Model ids OpenRouter serves, for the settings picker. */
export async function listOpenRouterModels(apiKey: string): Promise<string[]> {
  const key = apiKey.trim();
  const r = await fetch(`${OPENROUTER_BASE_URL}/v1/models`, {
    headers: key ? { Authorization: `Bearer ${key}` } : {},
    signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) throw new Error(`OpenRouter models: ${r.status}`);
  const data = await r.json();
  return ((data.data ?? []) as any[])
    .map((m) => String(m.id || ''))
    .filter(Boolean)
    .sort();
}
