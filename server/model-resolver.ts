/**
 * Resolve which model a completion should target.
 *
 * The configured model name is optional: when it is blank (or the explicit
 * `auto` sentinel) we ask the provider which model is currently loaded, so the
 * chat follows whatever the user has open in LM Studio / Ollama instead of
 * failing on a stale hardcoded name.
 */

export const AUTO_MODEL = 'auto';

export function isAutoModel(model: string | undefined | null): boolean {
  const value = (model ?? '').trim();
  return value === '' || value.toLowerCase() === AUTO_MODEL;
}

const trimSlash = (url: string) => url.replace(/\/$/, '');

/** LM Studio's native REST surface reports per-model load state; /v1 does not. */
async function lmstudioLoadedModel(baseUrl: string): Promise<string | undefined> {
  try {
    const r = await fetch(`${trimSlash(baseUrl)}/api/v0/models`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return undefined;
    const data = await r.json();
    const models: any[] = data.data ?? [];
    const loaded = models.find((m) => m.state === 'loaded' && m.type !== 'embeddings');
    return loaded?.id;
  } catch {
    return undefined;
  }
}

async function firstOpenAiModel(baseUrl: string): Promise<string | undefined> {
  try {
    const r = await fetch(`${trimSlash(baseUrl)}/v1/models`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return undefined;
    const data = await r.json();
    return (data.data ?? [])[0]?.id;
  } catch {
    return undefined;
  }
}

async function firstOllamaModel(baseUrl: string): Promise<string | undefined> {
  try {
    const r = await fetch(`${trimSlash(baseUrl)}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return undefined;
    const data = await r.json();
    return (data.models ?? [])[0]?.name;
  } catch {
    return undefined;
  }
}

export async function resolveModel(
  provider: string,
  configuredModel: string | undefined,
  baseUrl: string
): Promise<string | undefined> {
  if (!isAutoModel(configuredModel)) return (configuredModel ?? '').trim();

  if (provider === 'ollama') return firstOllamaModel(baseUrl);
  return (await lmstudioLoadedModel(baseUrl)) ?? (await firstOpenAiModel(baseUrl));
}
