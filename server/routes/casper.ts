import { Router } from 'express';
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

const router = Router();

router.get('/status', async (_req, res) => {
  try {
    const identity = await ensureMachineIdentity();
    const token = await getAccessToken();
    const relayUrl = await getRelayUrl();
    const workspace = await getWorkspaceRoot();
    const daemon = casperDaemon.getStatus();
    res.json({
      ...daemon,
      linked: !!token,
      userId: await getUserId(),
      machineId: identity.machineId,
      machineName: identity.machineName,
      relayUrl: getRelayHttpBase(relayUrl),
      approvalLevel: await getApprovalLevel(),
      workspaceRoot: workspace,
      face: 'Casper',
      brain: 'local-model',
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
