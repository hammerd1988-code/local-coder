import * as React from 'react';
import { setActiveApiBase, nodeApiBase, type NodeSummary } from '@/lib/ops';

export interface AddNodeInput {
  name?: string;
  host: string;
  user?: string;
  port?: number;
  remotePort?: number;
  identityFile?: string;
}

interface NodeContextValue {
  nodes: NodeSummary[];
  selectedId: string;
  selected: NodeSummary;
  apiBase: string;
  envRegistry: boolean;
  setSelectedId: (id: string) => void;
  refresh: () => void;
  addNode: (input: AddNodeInput) => Promise<void>;
  removeNode: (id: string) => Promise<void>;
}

const LOCAL: NodeSummary = { id: 'local', name: 'NODE-01', type: 'local', status: 'up' };

const NodeContext = React.createContext<NodeContextValue>({
  nodes: [LOCAL],
  selectedId: 'local',
  selected: LOCAL,
  apiBase: '',
  envRegistry: false,
  setSelectedId: () => {},
  refresh: () => {},
  addNode: async () => {},
  removeNode: async () => {},
});

export function useNode() {
  return React.useContext(NodeContext);
}

export function NodeProvider({ children }: { children: React.ReactNode }) {
  const [nodes, setNodes] = React.useState<NodeSummary[]>([LOCAL]);
  const [selectedId, setSelectedId] = React.useState('local');
  const [envRegistry, setEnvRegistry] = React.useState(false);

  const poll = React.useCallback(async () => {
    try {
      // Node registry always comes from the hub itself (base '').
      const res = await fetch('/api/nodes');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.nodes) && data.nodes.length > 0) setNodes(data.nodes);
      if (typeof data?.envRegistry === 'boolean') setEnvRegistry(data.envRegistry);
    } catch { /* keep last known registry */ }
  }, []);

  React.useEffect(() => {
    let disposed = false;
    const tick = () => { if (!disposed) poll(); };
    tick();
    const t = setInterval(tick, 5000);
    return () => { disposed = true; clearInterval(t); };
  }, [poll]);

  const addNode = React.useCallback(async (input: AddNodeInput) => {
    const res = await fetch('/api/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as any)?.error ?? `HTTP ${res.status}`);
    await poll();
  }, [poll]);

  const removeNode = React.useCallback(async (id: string) => {
    const res = await fetch(`/api/nodes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as any)?.error ?? `HTTP ${res.status}`);
    setSelectedId((cur) => (cur === id ? 'local' : cur));
    await poll();
  }, [poll]);

  const selected = nodes.find((n) => n.id === selectedId) ?? nodes[0] ?? LOCAL;
  const apiBase = nodeApiBase(selected);

  // Set the module-level base during render (before children read it) so a
  // node switch — which remounts modules via `key` — fetches against the
  // right target immediately.
  const appliedRef = React.useRef<string>('__unset__');
  if (appliedRef.current !== apiBase) {
    setActiveApiBase(apiBase);
    appliedRef.current = apiBase;
  }

  const value = React.useMemo<NodeContextValue>(
    () => ({ nodes, selectedId: selected.id, selected, apiBase, envRegistry, setSelectedId, refresh: poll, addNode, removeNode }),
    [nodes, selected, apiBase, envRegistry, poll, addNode, removeNode],
  );

  return <NodeContext.Provider value={value}>{children}</NodeContext.Provider>;
}
