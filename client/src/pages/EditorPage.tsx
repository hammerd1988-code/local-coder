import * as React from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { useNavigate } from 'react-router-dom';
import FileExplorer from '../components/FileExplorer';
import CodeEditor from '../components/CodeEditor';
import ChatPanel from '../components/ChatPanel';
import ThemeSwitcher from '../components/ThemeSwitcher';
import PluginsPanel from '../components/PluginsPanel';
import GitPanel from '../components/GitPanel';
import TerminalPanel from '../components/TerminalPanel';
import PreviewPanel from '../components/PreviewPanel';
import CasperPanel from '../components/CasperPanel';
import RepoCloner from '../components/RepoCloner';
import ApplyDiffDialog, { type PendingApply } from '../components/ApplyDiffDialog';
import { Button } from '../components/ui/button';
import { Activity, Plug, ServerCog } from 'lucide-react';

function stripPathComment(code: string): { path: string | null; body: string } {
  const first = code.split('\n')[0] ?? '';
  const pathMatch = first.match(/^(?:\/\/|#|\/\*|;|<!--)\s*([A-Za-z0-9_./\\-]+\.[A-Za-z0-9]+)/);
  const hintedPath = pathMatch?.[1]?.replace(/\\/g, '/') ?? null;
  if (!hintedPath) return { path: null, body: code };
  return { path: hintedPath, body: code.replace(/^[^\n]*\n?/, '') };
}

export default function EditorPage() {
  const navigate = useNavigate();
  const [selectedFileId, setSelectedFileId] = React.useState<number | null>(null);
  const [editorTheme, setEditorTheme] = React.useState<string>('vs-dark');
  const [rightPanel, setRightPanel] = React.useState<'chat' | 'plugins' | 'git' | 'terminal' | 'preview' | 'build' | 'casper'>('chat');
  const [bottomPanel, setBottomPanel] = React.useState(false);
  const [applyRequest, setApplyRequest] = React.useState<{ code: string; nonce: number } | null>(null);
  const [selectedFileIdTick, setSelectedFileIdTick] = React.useState(0);
  const [pendingApply, setPendingApply] = React.useState<PendingApply | null>(null);
  const [openFilePath, setOpenFilePath] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!selectedFileId) {
      setOpenFilePath(null);
      return;
    }
    fetch(`/api/files/${selectedFileId}`)
      .then((r) => r.json())
      .then((f) => setOpenFilePath(f.path))
      .catch(() => setOpenFilePath(null));
  }, [selectedFileId]);

  /** Queue a diff review before writing. */
  function handleApplyCode(code: string) {
    const { path: hintedPath, body } = stripPathComment(code);
    if (hintedPath) {
      setPendingApply({ path: hintedPath, nextContent: body, fileId: null });
      return;
    }
    if (selectedFileId && openFilePath) {
      setPendingApply({ path: openFilePath, nextContent: code, fileId: selectedFileId });
      return;
    }
    // No path and no open file — default to a scratch name the user can still cancel
    setPendingApply({ path: 'untitled.txt', nextContent: code, fileId: null });
  }

  async function confirmApply(pending: PendingApply) {
    const res = await fetch('/api/files/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: [{ path: pending.path, content: pending.nextContent }] }),
    });
    if (!res.ok) throw new Error('Apply failed');
    const data = await res.json();
    const written = data.files?.[0];
    if (written?.id) {
      setSelectedFileId(written.id);
      setApplyRequest({ code: pending.nextContent, nonce: Date.now() });
      setSelectedFileIdTick((n) => n + 1);
    }
    window.dispatchEvent(new Event('files-changed'));
    setPendingApply(null);
  }

  async function handleApplyMany(files: { path: string; content: string }[]) {
    if (files.length === 0) return;
    batchRef.current = files;
    // Show a batch summary in the diff dialog (confirm writes every file)
    setPendingApply({
      path: files.length === 1 ? files[0].path : `BATCH:${files.length}`,
      nextContent: files
        .map((f) => `======== ${f.path} ========\n${f.content}`)
        .join('\n\n'),
      fileId: null,
    });
  }

  const batchRef = React.useRef<{ path: string; content: string }[] | null>(null);

  async function confirmApplyOrBatch(pending: PendingApply) {
    if (batchRef.current && batchRef.current.length > 0) {
      const files = batchRef.current;
      batchRef.current = null;
      const res = await fetch('/api/files/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });
      if (!res.ok) throw new Error('Batch apply failed');
      const data = await res.json();
      const last = data.files?.[data.files.length - 1];
      if (last?.id) {
        setSelectedFileId(last.id);
        setApplyRequest({ code: last.content, nonce: Date.now() });
      }
      window.dispatchEvent(new Event('files-changed'));
      setPendingApply(null);
      return;
    }
    await confirmApply(pending);
  }

  React.useEffect(() => {
    loadTheme();
  }, []);

  async function loadTheme() {
    try {
      const response = await fetch('/api/settings');
      const settings = await response.json();
      if (settings.editorTheme) {
        setEditorTheme(settings.editorTheme);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  }

  async function handleThemeChange(theme: string) {
    setEditorTheme(theme);
    try {
      await fetch('/api/settings/editorTheme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: theme })
      });
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-black via-burgundy-950/80 to-black">
      <header className="h-12 border-b border-burgundy-500/60 flex items-center px-4 bg-black/70 backdrop-blur-sm justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-burgundy-400 bg-clip-text text-transparent">
            {'<'} LOCAL.CODE {'/>'}
          </h1>
          <RepoCloner />
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={() => setRightPanel('chat')}
            variant="ghost"
            className={`text-xs font-mono ${
              rightPanel === 'chat' 
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-[0_0_12px_rgba(196,2,51,0.45)]' 
                : 'text-gray-400 hover:text-cyan-400'
            }`}
          >
            CASPER
          </Button>
          <Button
            onClick={() => setRightPanel('casper')}
            variant="ghost"
            className={`text-xs font-mono ${
              rightPanel === 'casper'
                ? 'bg-burgundy-600/25 text-burgundy-300 border border-burgundy-500/60 shadow-[0_0_12px_rgba(196,2,51,0.6)]'
                : 'text-gray-400 hover:text-burgundy-300'
            }`}
            title="Link Casper to Blood Sweat Code / go online for remote"
          >
            REMOTE
          </Button>
          <Button
            onClick={() => setRightPanel('preview')}
            variant="ghost"
            className={`text-xs font-mono ${
              rightPanel === 'preview'
                ? 'bg-burgundy-600/25 text-burgundy-300 border border-burgundy-500/60 shadow-[0_0_12px_rgba(196,2,51,0.6)]'
                : 'text-gray-400 hover:text-burgundy-300'
            }`}
          >
            PREVIEW
          </Button>
          <Button
            onClick={() => setRightPanel('build')}
            variant="ghost"
            className={`text-xs font-mono ${
              rightPanel === 'build'
                ? 'bg-burgundy-600/25 text-burgundy-300 border border-burgundy-500/60 shadow-[0_0_12px_rgba(196,2,51,0.6)]'
                : 'text-gray-400 hover:text-burgundy-300'
            }`}
            title="Chat + live Preview side by side (Cursor-style build loop)"
          >
            BUILD
          </Button>
          <Button
            onClick={() => setRightPanel('git')}
            variant="ghost"
            className={`text-xs font-mono ${
              rightPanel === 'git' 
                ? 'bg-burgundy-600/25 text-burgundy-300 border border-burgundy-500/60 shadow-[0_0_12px_rgba(196,2,51,0.6)]' 
                : 'text-gray-400 hover:text-burgundy-300'
            }`}
          >
            GIT
          </Button>
          <Button
            onClick={() => setRightPanel('plugins')}
            variant="ghost"
            className={`text-xs font-mono ${
              rightPanel === 'plugins' 
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-[0_0_12px_rgba(196,2,51,0.45)]' 
                : 'text-gray-400 hover:text-cyan-400'
            }`}
          >
            PLUGINS
          </Button>
          <Button
            onClick={() => setBottomPanel(!bottomPanel)}
            variant="ghost"
            className={`text-xs font-mono ${
              bottomPanel 
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50 shadow-[0_0_12px_rgba(196,2,51,0.45)]' 
                : 'text-gray-400 hover:text-purple-400'
            }`}
          >
            TERMINAL
          </Button>
           <Button
             onClick={() => navigate('/integrations')}
             variant="ghost"
             className="text-xs font-mono text-gray-400 hover:text-cyan-400 gap-2"
           >
             <Plug className="w-4 h-4" />
             INTEGRATIONS
           </Button>
           <Button
             onClick={() => navigate('/metrics')}
             variant="ghost"
             className="text-xs font-mono text-gray-400 hover:text-green-400 gap-2"
           >
             <Activity className="w-4 h-4" />
             METRICS
           </Button>
           <Button
             onClick={() => navigate('/ops')}
             variant="ghost"
             className="text-xs font-mono text-gray-400 hover:text-fuchsia-400 gap-2"
             title="Open the NEO//OPS server control deck"
           >
             <ServerCog className="w-4 h-4" />
             SERVER OPS
           </Button>
        </div>
      </header>
      
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="vertical">
          <Panel defaultSize={bottomPanel ? 70 : 100} minSize={30}>
            <PanelGroup direction="horizontal">
              <Panel defaultSize={20} minSize={15} maxSize={30}>
                <FileExplorer 
                  selectedFileId={selectedFileId}
                  onSelectFile={setSelectedFileId}
                />
              </Panel>
              
              <PanelResizeHandle className="w-1 bg-burgundy-600/50 hover:bg-burgundy-400 hover:shadow-[0_0_8px_rgba(196,2,51,0.8)] transition-all" />
              
              <Panel defaultSize={50} minSize={30}>
                <div className="h-full flex flex-col">
                  <ThemeSwitcher theme={editorTheme} onThemeChange={handleThemeChange} />
                  <div className="flex-1">
                    <CodeEditor selectedFileId={selectedFileId} theme={editorTheme} applyRequest={applyRequest} />
                  </div>
                </div>
              </Panel>
              
              <PanelResizeHandle className="w-1 bg-burgundy-600/50 hover:bg-burgundy-400 hover:shadow-[0_0_8px_rgba(196,2,51,0.8)] transition-all" />
              
              <Panel defaultSize={rightPanel === 'build' ? 40 : 30} minSize={20} maxSize={55}>
                {rightPanel === 'chat' && (
                  <ChatPanel
                    key={`chat-${selectedFileIdTick}`}
                    selectedFileId={selectedFileId}
                    onApplyCode={handleApplyCode}
                    onApplyMany={handleApplyMany}
                  />
                )}
                {rightPanel === 'build' && (
                  <PanelGroup direction="vertical">
                    <Panel defaultSize={55} minSize={30}>
                      <ChatPanel
                        selectedFileId={selectedFileId}
                        onApplyCode={handleApplyCode}
                        onApplyMany={handleApplyMany}
                      />
                    </Panel>
                    <PanelResizeHandle className="h-1 bg-burgundy-600/50 hover:bg-burgundy-400 hover:shadow-[0_0_8px_rgba(196,2,51,0.8)] transition-all" />
                    <Panel defaultSize={45} minSize={20}>
                      <PreviewPanel />
                    </Panel>
                  </PanelGroup>
                )}
                {rightPanel === 'casper' && <CasperPanel />}
                {rightPanel === 'plugins' && <PluginsPanel />}
                {rightPanel === 'git' && <GitPanel />}
                {rightPanel === 'preview' && <PreviewPanel />}
              </Panel>
            </PanelGroup>
          </Panel>
          
          {bottomPanel && (
            <>
              <PanelResizeHandle className="h-1 bg-burgundy-600/50 hover:bg-burgundy-400 hover:shadow-[0_0_8px_rgba(196,2,51,0.8)] transition-all" />
              <Panel defaultSize={30} minSize={15} maxSize={70}>
                <TerminalPanel />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      <ApplyDiffDialog
        pending={pendingApply}
        onCancel={() => { batchRef.current = null; setPendingApply(null); }}
        onConfirm={confirmApplyOrBatch}
      />
    </div>
  );
}
