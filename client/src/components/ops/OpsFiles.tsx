import * as React from 'react';
import Editor from '@monaco-editor/react';
import {
  Folder, FileText, Link2, Download, Upload, Trash2, FolderPlus, FilePlus,
  PenLine, Shield, RefreshCw, Home, HardDrive, X, Save,
} from 'lucide-react';
import { OpsPanel } from './OpsPanel';
import { opsGet, opsPost, formatBytes, formatTimestamp, type FsEntry } from '@/lib/ops';

const LANG_BY_EXT: Record<string, string> = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript', json: 'json', md: 'markdown',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', c: 'c', h: 'c', cpp: 'cpp',
  sh: 'shell', bash: 'shell', yml: 'yaml', yaml: 'yaml', toml: 'ini', ini: 'ini',
  conf: 'ini', css: 'css', html: 'html', xml: 'xml', sql: 'sql', service: 'ini',
};

function langFor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return LANG_BY_EXT[ext] ?? 'plaintext';
}

function joinPath(dir: string, name: string): string {
  return dir === '/' ? `/${name}` : `${dir}/${name}`;
}

interface OpenFile {
  path: string;
  content: string;
  dirty: boolean;
  binary?: boolean;
  tooLarge?: boolean;
  size: number;
}

export function OpsFiles() {
  const [cwd, setCwd] = React.useState('/');
  const [pathInput, setPathInput] = React.useState('/');
  const [entries, setEntries] = React.useState<FsEntry[]>([]);
  const [home, setHome] = React.useState('/root');
  const [error, setError] = React.useState('');
  const [filter, setFilter] = React.useState('');
  const [selected, setSelected] = React.useState<string | null>(null);
  const [openFile, setOpenFile] = React.useState<OpenFile | null>(null);
  const [busy, setBusy] = React.useState(false);
  const uploadRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async (dir: string) => {
    setBusy(true);
    setError('');
    try {
      const data = await opsGet<{ path: string; home: string; items: FsEntry[] }>(`/api/sysfs/list?path=${encodeURIComponent(dir)}`);
      setEntries(data.items);
      setCwd(data.path);
      setPathInput(data.path);
      setHome(data.home);
      setSelected(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, []);

  React.useEffect(() => { load('/'); }, [load]);

  const openEntry = async (e: FsEntry) => {
    const full = joinPath(cwd, e.name);
    if (e.type === 'dir') {
      load(full);
      return;
    }
    try {
      const data = await opsGet<{ path: string; size: number; content?: string; binary?: boolean; tooLarge?: boolean }>(
        `/api/sysfs/read?path=${encodeURIComponent(full)}`,
      );
      setOpenFile({ path: data.path, content: data.content ?? '', dirty: false, binary: data.binary, tooLarge: data.tooLarge, size: data.size });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openFileRef = React.useRef<OpenFile | null>(null);
  openFileRef.current = openFile;

  const saveFile = React.useCallback(async () => {
    const f = openFileRef.current;
    if (!f || f.binary || f.tooLarge) return;
    try {
      await opsPost('/api/sysfs/write', { path: f.path, content: f.content });
      setOpenFile((cur) => (cur && cur.path === f.path ? { ...cur, dirty: false } : cur));
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const act = async (fn: () => Promise<unknown>) => {
    setError('');
    try {
      await fn();
      await load(cwd);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const mkdir = () => {
    const name = window.prompt('New directory name:');
    if (name) act(() => opsPost('/api/sysfs/mkdir', { path: joinPath(cwd, name) }));
  };

  const touch = () => {
    const name = window.prompt('New file name:');
    if (name) act(() => opsPost('/api/sysfs/touch', { path: joinPath(cwd, name) }));
  };

  const rename = () => {
    if (!selected) return;
    const to = window.prompt('Rename / move to:', joinPath(cwd, selected));
    if (to) act(() => opsPost('/api/sysfs/rename', { from: joinPath(cwd, selected), to }));
  };

  const del = () => {
    if (!selected) return;
    if (!window.confirm(`PERMANENTLY delete ${joinPath(cwd, selected)}?`)) return;
    act(() => opsPost('/api/sysfs/delete', { path: joinPath(cwd, selected) }));
  };

  const chmod = () => {
    if (!selected) return;
    const mode = window.prompt('Octal mode (e.g. 755):', '644');
    if (mode) act(() => opsPost('/api/sysfs/chmod', { path: joinPath(cwd, selected), mode }));
  };

  const download = () => {
    if (!selected) return;
    window.open(`/api/sysfs/download?path=${encodeURIComponent(joinPath(cwd, selected))}`, '_blank');
  };

  const upload = async (file: File) => {
    setError('');
    try {
      const res = await fetch(`/api/sysfs/upload?path=${encodeURIComponent(joinPath(cwd, file.name))}`, {
        method: 'PUT',
        body: file,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as any)?.error ?? `HTTP ${res.status}`);
      await load(cwd);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const crumbs = cwd === '/' ? [''] : cwd.split('/');
  const shown = entries.filter((e) => !filter || e.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="h-full flex gap-3 p-3 min-h-0">
      {/* Browser */}
      <OpsPanel
        title="Filesystem // Navigator"
        className={openFile ? 'w-[46%] shrink-0' : 'flex-1'}
        right={
          <button className="ops-btn !px-2 !py-0.5" onClick={() => load(cwd)} title="Refresh">
            <RefreshCw size={11} className={busy ? 'animate-spin' : ''} />
          </button>
        }
        bodyClassName="flex flex-col min-h-0"
      >
        {/* path bar */}
        <div className="flex items-center gap-2 p-2 border-b border-cyan-400/10 shrink-0">
          <button className="ops-btn !px-2" title="Root" onClick={() => load('/')}><HardDrive size={12} /></button>
          <button className="ops-btn !px-2" title="Home" onClick={() => load(home)}><Home size={12} /></button>
          <form
            className="flex-1"
            onSubmit={(e) => { e.preventDefault(); load(pathInput); }}
          >
            <input className="ops-input w-full" value={pathInput} onChange={(e) => setPathInput(e.target.value)} spellCheck={false} />
          </form>
          <input className="ops-input w-32" placeholder="filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>

        {/* breadcrumbs */}
        <div className="flex items-center flex-wrap gap-1 px-3 py-1 text-[11px] border-b border-cyan-400/10 shrink-0">
          {crumbs.map((c, i) => {
            const target = i === 0 ? '/' : crumbs.slice(0, i + 1).join('/') || '/';
            return (
              <React.Fragment key={i}>
                {i > 0 && <span style={{ color: 'var(--ops-dim)' }}>/</span>}
                <button className="hover:underline ops-glow-cyan" onClick={() => load(target)}>
                  {i === 0 ? '⌁root' : c}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* toolbar */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-cyan-400/10 shrink-0 flex-wrap">
          <button className="ops-btn" onClick={touch}><FilePlus size={11} className="inline mr-1" />File</button>
          <button className="ops-btn" onClick={mkdir}><FolderPlus size={11} className="inline mr-1" />Dir</button>
          <button className="ops-btn" onClick={() => uploadRef.current?.click()}><Upload size={11} className="inline mr-1" />Up</button>
          <button className="ops-btn" disabled={!selected} onClick={download}><Download size={11} className="inline mr-1" />Down</button>
          <button className="ops-btn" disabled={!selected} onClick={rename}><PenLine size={11} className="inline mr-1" />Move</button>
          <button className="ops-btn" disabled={!selected} onClick={chmod}><Shield size={11} className="inline mr-1" />Mode</button>
          <button className="ops-btn ops-btn-red" disabled={!selected} onClick={del}><Trash2 size={11} className="inline mr-1" />Del</button>
          <input ref={uploadRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
        </div>

        {error && <div className="px-3 py-1 text-[11px] ops-glow-red shrink-0">⚠ {error}</div>}

        {/* listing */}
        <div className="flex-1 overflow-auto min-h-0">
          <table className="ops-table">
            <thead>
              <tr><th>Name</th><th>Size</th><th>Mode</th><th>Owner</th><th>Modified</th></tr>
            </thead>
            <tbody>
              {cwd !== '/' && (
                <tr className="cursor-pointer" onClick={() => load(cwd.split('/').slice(0, -1).join('/') || '/')}>
                  <td colSpan={5} style={{ color: 'var(--ops-dim)' }}>↩ ..</td>
                </tr>
              )}
              {shown.map((e) => (
                <tr
                  key={e.name}
                  className="cursor-pointer"
                  style={selected === e.name ? { background: 'rgba(0,240,255,0.12)' } : undefined}
                  onClick={() => setSelected(e.name)}
                  onDoubleClick={() => openEntry(e)}
                >
                  <td>
                    <span className="inline-flex items-center gap-1.5">
                      {e.type === 'dir'
                        ? <Folder size={12} style={{ color: 'var(--ops-cyan)' }} />
                        : e.symlink
                          ? <Link2 size={12} style={{ color: 'var(--ops-magenta)' }} />
                          : <FileText size={12} style={{ color: 'var(--ops-dim)' }} />}
                      <span style={{ color: e.type === 'dir' ? 'var(--ops-cyan)' : '#d7f6ff' }}>{e.name}</span>
                      {e.linkTarget && <span className="text-[10px]" style={{ color: 'var(--ops-dim)' }}>→ {e.linkTarget}</span>}
                    </span>
                  </td>
                  <td style={{ color: 'var(--ops-dim)' }}>{e.type === 'dir' ? '—' : formatBytes(e.size)}</td>
                  <td style={{ color: 'var(--ops-yellow)', opacity: 0.8 }}>{e.mode}</td>
                  <td style={{ color: 'var(--ops-dim)' }}>{e.owner}:{e.group}</td>
                  <td style={{ color: 'var(--ops-dim)' }}>{formatTimestamp(e.mtime)}</td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr><td colSpan={5} className="text-center py-6" style={{ color: 'var(--ops-dim)' }}>EMPTY SECTOR</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-1 text-[10px] border-t border-cyan-400/10 shrink-0" style={{ color: 'var(--ops-dim)' }}>
          {shown.length} objects // {cwd}
        </div>
      </OpsPanel>

      {/* Editor */}
      {openFile && (
        <OpsPanel
          title={`Edit // ${openFile.path}`}
          accent="magenta"
          className="flex-1"
          right={
            <div className="flex items-center gap-2">
              {openFile.dirty && <span className="text-[10px] ops-glow-yellow ops-pulse">● UNSAVED</span>}
              <button className="ops-btn ops-btn-magenta !py-0.5" disabled={!openFile.dirty} onClick={saveFile}>
                <Save size={11} className="inline mr-1" />Save
              </button>
              <button className="ops-btn !px-2 !py-0.5" onClick={() => setOpenFile(null)}><X size={11} /></button>
            </div>
          }
          bodyClassName="min-h-0"
        >
          {openFile.binary || openFile.tooLarge ? (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <div className="ops-display ops-glow-magenta text-sm">
                {openFile.binary ? 'BINARY OBJECT' : 'FILE EXCEEDS 2MB EDIT LIMIT'}
              </div>
              <div className="text-xs" style={{ color: 'var(--ops-dim)' }}>{formatBytes(openFile.size)}</div>
              <button className="ops-btn" onClick={() => window.open(`/api/sysfs/download?path=${encodeURIComponent(openFile.path)}`, '_blank')}>
                <Download size={11} className="inline mr-1" />Download
              </button>
            </div>
          ) : (
            <Editor
              height="100%"
              language={langFor(openFile.path)}
              value={openFile.content}
              theme="vs-dark"
              onChange={(v) => setOpenFile((f) => (f ? { ...f, content: v ?? '', dirty: true } : f))}
              onMount={(editor, monaco) => {
                monaco.editor.defineTheme('ops-cyber', {
                  base: 'vs-dark',
                  inherit: true,
                  rules: [
                    { token: 'comment', foreground: '4a6b8a' },
                    { token: 'keyword', foreground: 'ff2bd6' },
                    { token: 'string', foreground: '39ff88' },
                    { token: 'number', foreground: 'fcee0a' },
                    { token: 'type', foreground: '00f0ff' },
                  ],
                  colors: {
                    'editor.background': '#060b16',
                    'editor.foreground': '#b8e6f5',
                    'editor.lineHighlightBackground': '#0a1626',
                    'editorLineNumber.foreground': '#2a4560',
                    'editorCursor.foreground': '#00f0ff',
                    'editor.selectionBackground': '#0f3550',
                  },
                });
                monaco.editor.setTheme('ops-cyber');
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => { void saveFile(); });
              }}
              options={{ fontSize: 12, fontFamily: "'Share Tech Mono', monospace", minimap: { enabled: false }, scrollBeyondLastLine: false }}
            />
          )}
        </OpsPanel>
      )}
    </div>
  );
}
