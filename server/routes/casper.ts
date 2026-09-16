import { Router, type Response } from 'express';
import {
  clearAuth,
  ensureMachineIdentity,
  getAccessToken,
  getApprovalLevel,
  getRelayHttpBase,
  getRelayUrl,
  getUserId,
  setAccessToken,
  setRelayUrl,
} from '../casper/config.js';
import { casperDaemon } from '../casper/daemon.js';
import { getWorkspaceRoot } from '../workspace.js';
import {
  BscSyncError,
  applyBscModelPlan,
  clearSnapshot,
  fetchBscAiSettings,
  getBscSyncStatus,
  hasKeyForPlan,
  planBscModel,
  refreshBscModelIfFollowing,
} from '../casper/bsc-model-sync.js';
import { PROVIDER_LABELS, getModelSettings } from '../model-provider.js';

const router = Router();

router.get('/status', async (_req, res) => {
  try {
    const identity = await ensureMachineIdentity();
    const token = await getAccessToken();
    const relayUrl = await getRelayUrl();
    const workspace = await getWorkspaceRoot();
    const daemon = casperDaemon.getStatus();
    const model = await getModelSettings();
    const bscSync = await getBscSyncStatus();
    res.json({
      ...daemon,
      linked: !!token,
      model: { provider: model.provider, providerLabel: PROVIDER_LABELS[model.provider], name: model.model },
      bscSync,
      userId: await getUserId(),
      machineId: identity.machineId,
      machineName: identity.machineName,
      relayUrl: getRelayHttpBase(relayUrl),
      approvalLevel: await getApprovalLevel(),
      workspaceRoot: workspace,
      face: 'Casper',
      brain: bscSync.following ? 'bsc-v3' : model.provider,
      home: 'Local Code',
    });
    return;
  } catch (error) {
    console.error('casper status error', error);
    res.status(500).json({ error: 'Failed to read Casper status' });
    return;
  }
});

router.put('/relay', async (req, res) => {
  try {
    const { relayUrl } = req.body as { relayUrl?: string };
    if (!relayUrl?.trim()) {
      res.status(400).json({ error: 'relayUrl required' });
      return;
    }
    await setRelayUrl(relayUrl.trim());
    res.json({ relayUrl: getRelayHttpBase(relayUrl.trim()) });
    return;
  } catch (error) {
    res.status(500).json({ error: 'Failed to save relay URL' });
    return;
  }
});

/** Start device-code pairing against BSC Railway relay. */
router.post('/link/start', async (_req, res) => {
  try {
    const { machineId, machineName } = await ensureMachineIdentity();
    const base = getRelayHttpBase(await getRelayUrl());
    const response = await fetch(`${base}/api/casper/relay/device/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machineId, machineName }),
    });
    const data = await response.json() as any;
    if (!response.ok || !data.success) {
      res.status(502).json({ error: data.error || `Relay init failed (${response.status})` });
      return;
    }
    res.json({
      deviceCode: data.deviceCode,
      userCode: data.userCode,
      verificationUrl: data.verificationUrl,
      expiresIn: data.expiresIn,
      interval: data.interval,
      relayUrl: base,
    });
    return;
  } catch (error) {
    console.error('casper link start', error);
    res.status(502).json({ error: error instanceof Error ? error.message : 'Could not reach relay' });
    return;
  }
});

router.post('/link/poll', async (req, res) => {
  try {
    const { deviceCode } = req.body as { deviceCode?: string };
    if (!deviceCode) {
      res.status(400).json({ error: 'deviceCode required' });
      return;
    }
    const base = getRelayHttpBase(await getRelayUrl());
    const response = await fetch(`${base}/api/casper/relay/device/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceCode }),
    });
    const data = await response.json() as any;
    if (data.status === 'authorized' && data.accessToken) {
      await setAccessToken(data.accessToken, data.userId);
      // Auto-start daemon after successful link
      const status = await casperDaemon.start();
      res.json({ status: 'authorized', userId: data.userId, daemon: status });
      return;
    }
    res.json({ status: data.status || 'pending' });
    return;
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Poll failed' });
    return;
  }
});

function sendSyncError(res: Response, error: unknown, fallback: string) {
  if (error instanceof BscSyncError) {
    res.status(error.status >= 400 && error.status < 600 ? error.status : 502).json({ error: error.message });
    return;
  }
  console.error(fallback, error);
  res.status(500).json({ error: error instanceof Error ? error.message : fallback });
}

/** Preview what "Same model as BSC-V3" would set, without changing anything. */
router.get('/bsc-model', async (_req, res) => {
  try {
    const remote = await fetchBscAiSettings();
    const plan = planBscModel(remote);
    res.json({
      plan: { provider: plan.provider, providerLabel: PROVIDER_LABELS[plan.provider], model: plan.model, baseUrl: plan.baseUrl ?? null },
      needsKey: !(await hasKeyForPlan(plan)),
      keyField: plan.keyField,
      modelSource: remote.modelSource,
      endpointSource: remote.endpointSource,
      ...(await getBscSyncStatus()),
    });
    return;
  } catch (error) {
    sendSyncError(res, error, 'casper bsc-model preview');
  }
});

/** Copy the BSC-V3 AI Core model/endpoint into Casper's settings and follow it. */
router.post('/bsc-model/apply', async (_req, res) => {
  try {
    const plan = planBscModel(await fetchBscAiSettings());
    const snapshot = await applyBscModelPlan(plan);
    res.json({
      snapshot,
      providerLabel: PROVIDER_LABELS[plan.provider],
      needsKey: !(await hasKeyForPlan(plan)),
      keyField: plan.keyField,
      following: true,
    });
    return;
  } catch (error) {
    sendSyncError(res, error, 'casper bsc-model apply');
  }
});

/** Re-check BSC-V3 now (only changes settings while still following). */
router.post('/bsc-model/refresh', async (_req, res) => {
  const result = await refreshBscModelIfFollowing({ force: true });
  res.json({ result, ...(await getBscSyncStatus()) });
  return;
});

router.post('/bsc-model/unfollow', async (_req, res) => {
  await clearSnapshot();
  res.json(await getBscSyncStatus());
  return;
});

router.post('/unlink', async (_req, res) => {
  casperDaemon.stop();
  await clearAuth();
  res.json({ ok: true, ...casperDaemon.getStatus(), linked: false });
  return;
});

router.post('/daemon/start', async (_req, res) => {
  const status = await casperDaemon.start();
  res.json(status);
  return;
});

router.post('/daemon/stop', (_req, res) => {
  res.json(casperDaemon.stop());
  return;
});

export default router;
