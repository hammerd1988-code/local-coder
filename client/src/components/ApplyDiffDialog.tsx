import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';

export interface PendingApply {
  path: string;
  nextContent: string;
  fileId?: number | null;
}

interface ApplyDiffDialogProps {
  pending: PendingApply | null;
  onCancel: () => void;
  onConfirm: (pending: PendingApply) => Promise<void>;
}

export default function ApplyDiffDialog({ pending, onCancel, onConfirm }: ApplyDiffDialogProps) {
  const [before, setBefore] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [applying, setApplying] = React.useState(false);

  const isBatch = !!pending?.path?.startsWith('BATCH:');

  React.useEffect(() => {
    if (!pending) {
      setBefore(null);
      return;
    }
    if (pending.path.startsWith('BATCH:')) {
      setBefore('(multiple files — confirm to write all proposed changes)');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const files: { id: number; path: string }[] = await (await fetch('/api/files')).json();
        const hit = pending.fileId
          ? { id: pending.fileId, path: pending.path }
          : files.find((f) => f.path === pending.path);
        if (hit) {
          const f = await (await fetch(`/api/files/${hit.id}`)).json();
          if (!cancelled) setBefore(typeof f.content === 'string' ? f.content : '');
        } else if (!cancelled) {
          setBefore('');
        }
      } catch {
        if (!cancelled) setBefore('');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pending?.path, pending?.fileId, pending?.nextContent]);

  const isNew = !isBatch && before === '';
  const unchanged = !isBatch && before !== null && before === pending?.nextContent;

  async function confirm() {
    if (!pending) return;
    setApplying(true);
    try {
      await onConfirm(pending);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Dialog open={!!pending} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="bg-gray-950 border-burgundy-500/50 max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-burgundy-300 font-mono text-sm">
            {pending?.path?.startsWith('BATCH:')
              ? `Review ${pending.path.slice(6)} files`
              : `${isNew ? 'Create file' : unchanged ? 'No changes' : 'Review change'} · ${pending?.path}`}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-col min-h-0 border border-red-500/30 rounded overflow-hidden">
            <div className="text-[10px] uppercase tracking-wider px-2 py-1 bg-red-950/50 text-red-300 border-b border-red-500/30">
              Current
            </div>
            <pre className="flex-1 overflow-auto p-2 text-xs font-mono text-red-100/80 bg-black/70 whitespace-pre-wrap">
              {loading || before === null ? 'Loading…' : (before || '(new file)')}
            </pre>
          </div>
          <div className="flex flex-col min-h-0 border border-emerald-500/30 rounded overflow-hidden">
            <div className="text-[10px] uppercase tracking-wider px-2 py-1 bg-emerald-950/50 text-emerald-300 border-b border-emerald-500/30">
              Proposed
            </div>
            <pre className="flex-1 overflow-auto p-2 text-xs font-mono text-emerald-100/80 bg-black/70 whitespace-pre-wrap">
              {pending?.nextContent ?? ''}
            </pre>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onCancel} className="text-gray-400 hover:text-cyan-300">
            Cancel
          </Button>
          <Button
            onClick={confirm}
            disabled={loading || applying || unchanged}
            className="bg-gradient-to-r from-purple-600 to-burgundy-600 hover:from-purple-500 hover:to-burgundy-500 disabled:opacity-40"
          >
            {applying ? 'Applying…' : isNew ? 'Create file' : 'Apply change'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
