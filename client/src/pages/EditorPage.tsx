import * as React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import FileExplorer from '../components/FileExplorer';
import CodeEditor from '../components/CodeEditor';
import ChatPanel from '../components/ChatPanel';
import ThemeSwitcher from '../components/ThemeSwitcher';
import PluginsPanel from '../components/PluginsPanel';
import GitPanel from '../components/GitPanel';
import TerminalPanel from '../components/TerminalPanel';
import RepoCloner from '../components/RepoCloner';
import { Button } from '../components/ui/button';

export default function EditorPage() {
  const [selectedFileId, setSelectedFileId] = React.useState<number | null>(null);
  const [editorTheme, setEditorTheme] = React.useState<string>('vs-dark');
  const [rightPanel, setRightPanel] = React.useState<'chat' | 'plugins' | 'git' | 'terminal'>('chat');
  const [bottomPanel, setBottomPanel] = React.useState(false);

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
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-950 via-purple-950/20 to-cyan-950/20">
      <header className="h-12 border-b border-cyan-500/30 flex items-center px-4 bg-black/40 backdrop-blur-sm justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
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
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50' 
                : 'text-gray-400 hover:text-cyan-400'
            }`}
          >
            CHAT
          </Button>
          <Button
            onClick={() => setRightPanel('git')}
            variant="ghost"
            className={`text-xs font-mono ${
              rightPanel === 'git' 
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50' 
                : 'text-gray-400 hover:text-cyan-400'
            }`}
          >
            GIT
          </Button>
          <Button
            onClick={() => setRightPanel('plugins')}
            variant="ghost"
            className={`text-xs font-mono ${
              rightPanel === 'plugins' 
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50' 
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
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50' 
                : 'text-gray-400 hover:text-purple-400'
            }`}
          >
            TERMINAL
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
              
              <PanelResizeHandle className="w-1 bg-cyan-500/30 hover:bg-cyan-400 transition-colors" />
              
              <Panel defaultSize={50} minSize={30}>
                <div className="h-full flex flex-col">
                  <ThemeSwitcher theme={editorTheme} onThemeChange={handleThemeChange} />
                  <div className="flex-1">
                    <CodeEditor selectedFileId={selectedFileId} theme={editorTheme} />
                  </div>
                </div>
              </Panel>
              
              <PanelResizeHandle className="w-1 bg-cyan-500/30 hover:bg-cyan-400 transition-colors" />
              
              <Panel defaultSize={30} minSize={20} maxSize={50}>
                {rightPanel === 'chat' && <ChatPanel selectedFileId={selectedFileId} />}
                {rightPanel === 'plugins' && <PluginsPanel />}
                {rightPanel === 'git' && <GitPanel />}
              </Panel>
            </PanelGroup>
          </Panel>
          
          {bottomPanel && (
            <>
              <PanelResizeHandle className="h-1 bg-purple-500/30 hover:bg-purple-400 transition-colors" />
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
