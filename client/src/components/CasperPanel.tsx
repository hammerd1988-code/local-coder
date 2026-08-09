import * as React from 'react';
import { Link2, Radio, Unplug, ExternalLink, FolderOpen } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface CasperStatus {
  running: boolean;
  connected: boolean;
  linked: boolean;
  machineId: string | null;
  machineName: string | null;
  relayUrl: string | null;
  sessionId: string | null;
  lastError: string | null;
  workspaceRoot: string | null;
  face?: string;
  brain?: string;
  home?: string;
}

export default function CasperPanel() {
  const [status, setStatus] = React.useState<CasperStatus | null>(null);
  const [relayDraft, setRelayDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [link, setLink] = React.useState<{
    userCode: string;
    verificationUrl: string;
    deviceCode: string;
  } | null>(null);

  async function refresh() {
    try {
      const data = await (await fetch('/api/casper/status')).json();
      setStatus(data);
      if (data.relayUrl) setRelayDraft(data.relayUrl);
    } catch (e) {
      setError('Could not load Casper status');
    }
  }

  React.useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => {
    if (!link) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch('/api/casper/link/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceCode: link.deviceCode }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.status === 'authorized') {
          setLink(null);
          setBusy(false);
          await refresh();
          return;
        }
        if (data.status === 'expired') {
          setError('Code expired — start linking again');
          setLink(null);
          setBusy(false);
        }
      } catch {
        // keep polling
      }
    };
    const id = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [link]);

  async function saveRelay() {
    setError(null);
    await fetch('/api/casper/relay', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relayUrl: relayDraft }),
    });
    await refresh();
  }

  async function startLink() {
    setBusy(true);
    setError(null);
    try {
      await saveRelay();
      const res = await fetch('/api/casper/link/start', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Link failed');
      setLink({
        userCode: data.userCode,
        verificationUrl: data.verificationUrl,
        deviceCode: data.deviceCode,
      });
      window.open(data.verificationUrl, '_blank');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Link failed');
      setBusy(false);
    }
  }

  async function goOnline() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/casper/daemon/start', { method: 'POST' });
      const data = await res.json();
      if (data.lastError && !data.connected && !data.running) setError(data.lastError);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function goOffline() {
    setBusy(true);
    await fetch('/api/casper/daemon/stop', { method: 'POST' });
    await refresh();
    setBusy(false);
  }

  async function unlink() {
    setBusy(true);
    await fetch('/api/casper/unlink', { method: 'POST' });
    setLink(null);
    await refresh();
    setBusy(false);
  }

  const online = status?.connected;
  const linked = status?.linked;

  return (
    <div className="h-full flex flex-col bg-black/60 backdrop-blur-sm font-mono">
      <div className="p-4 border-b border-burgundy-500/50">
        <h2 className="font-semibold text-burgundy-300">{'>'} Casper Remote</h2>
        <p className="text-[11px] text-purple-300/70 mt-1">
          Casper is the agent. Local Code is home. Your local model is the brain.
          Link to Blood Sweat Code (Railway) so phone/web can reach this machine.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        <div className="rounded border border-cyan-500/30 bg-black/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-cyan-300">Status</span>
            <span className={`text-xs px-2 py-0.5 rounded border ${
              online
                ? 'border-emerald-500/50 text-emerald-300 bg-emerald-500/10'
                : linked
                  ? 'border-amber-500/50 text-amber-300 bg-amber-500/10'
                  : 'border-gray-600 text-gray-400'
            }`}>
              {online ? 'ONLINE' : linked ? 'LINKED · OFFLINE' : 'NOT LINKED'}
            </span>
          </div>
          <p className="text-[11px] text-purple-300/80">
            Machine: {status?.machineName || '…'}
          </p>
          <p className="text-[10px] text-gray-500 truncate" title={status?.machineId || ''}>
            id: {status?.machineId || '…'}
          </p>
          {status?.workspaceRoot ? (
            <p className="text-[11px] text-cyan-400/80 flex items-center gap-1 truncate">
              <FolderOpen className="h-3 w-3 shrink-0" /> {status.workspaceRoot}
            </p>
          ) : (
            <p className="text-[11px] text-amber-300/80">
              Open a workspace folder in Files first — Casper tools need a real disk root.
            </p>
          )}
          {status?.lastError && (
            <p className="text-[11px] text-red-400">{status.lastError}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-purple-300">Relay URL (Railway / BSC)</Label>
          <Input
            value={relayDraft}
            onChange={(e) => setRelayDraft(e.target.value)}
            placeholder="https://bloodsweatcode.org"
            className="bg-black/40 border-burgundy-500/50 text-cyan-100 text-xs"
          />
          <Button size="sm" variant="ghost" onClick={saveRelay} className="text-cyan-400 hover:bg-cyan-500/10">
            Save relay
          </Button>
        </div>

        {link && (
          <div className="rounded border border-burgundy-500/50 bg-burgundy-950/40 p-3 space-y-2">
            <p className="text-burgundy-200 text-xs">Enter this code in the browser:</p>
            <p className="text-2xl tracking-widest text-cyan-300 font-bold">{link.userCode}</p>
            <a
              href={link.verificationUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-purple-300 underline inline-flex items-center gap-1"
            >
              Open verification page <ExternalLink className="h-3 w-3" />
            </a>
            <p className="text-[10px] text-gray-500">Waiting for approval…</p>
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {!linked && (
            <Button
              disabled={busy}
              onClick={startLink}
              className="bg-gradient-to-r from-purple-600 to-burgundy-600 gap-2"
            >
              <Link2 className="h-4 w-4" /> Link machine
            </Button>
          )}
          {linked && !online && (
            <Button disabled={busy} onClick={goOnline} className="bg-emerald-700 hover:bg-emerald-600 gap-2">
              <Radio className="h-4 w-4" /> Go online
            </Button>
          )}
          {online && (
            <Button disabled={busy} onClick={goOffline} variant="ghost" className="text-amber-300 hover:bg-amber-500/10 gap-2">
              <Unplug className="h-4 w-4" /> Go offline
            </Button>
          )}
          {linked && (
            <Button disabled={busy} onClick={unlink} variant="ghost" className="text-red-400 hover:bg-red-500/10">
              Unlink
            </Button>
          )}
        </div>

        <div className="text-[10px] text-purple-400/50 space-y-1 border-t border-white/5 pt-3">
          <p>Face: Casper · Home: Local Code · Brain: your local model</p>
          <p>Remote chats from BSC mobile/web hit this daemon over the Railway relay.</p>
        </div>
      </div>
    </div>
  );
}
