import * as React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useNavigate } from 'react-router-dom';
import FileExplorer from '../components/FileExplorer';
import CodeEditor from '../components/CodeEditor';
import ChatPanel from '../components/ChatPanel';
import ThemeSwitcher from '../components/ThemeSwitcher';
import PluginsPanel from '../components/PluginsPanel';
import GitPanel from '../components/GitPanel';
import TerminalPanel from '../components/TerminalPanel';
import PreviewPanel from '../components/PreviewPanel';
import RepoCloner from '../components/RepoCloner';
import { Button } from '../components/ui/button';
import { Activity, Plug } from 'lucide-react';

export default function EditorPage() {
  const navigate = useNavigate();
  const [selectedFileId, setSelectedFileId] = React.useState<number | null>(null);
  const [editorTheme, setEditorTheme] = React.useState<string>('vs-dark');
  const [rightPanel, setRightPanel] = React.useState<'chat' | 'plugins' | 'git' | 'terminal' | 'preview'>('chat');
  const [bottomPanel, setBottomPanel] = React.useState(false);
  const [applyRequest, setApplyRequest] = React.useState<{ code: string; nonce: number } | null>(null);

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
            CHAT
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
              
              <Panel defaultSize={30} minSize={20} maxSize={50}>
                {rightPanel === 'chat' && (
                  <ChatPanel
                    selectedFileId={selectedFileId}
                    onApplyCode={(code) => setApplyRequest({ code, nonce: Date.now() })}
                  />
                )}
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
    </div>
  );
}
