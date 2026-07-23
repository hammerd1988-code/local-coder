import * as React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import FileExplorer from '../components/FileExplorer';
import CodeEditor from '../components/CodeEditor';
import ChatPanel from '../components/ChatPanel';
import ThemeSwitcher from '../components/ThemeSwitcher';

export default function EditorPage() {
  const [selectedFileId, setSelectedFileId] = React.useState<number | null>(null);
  const [editorTheme, setEditorTheme] = React.useState<string>('vs-dark');

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
      <header className="h-12 border-b border-cyan-500/30 flex items-center px-4 bg-black/40 backdrop-blur-sm">
        <h1 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          {'<'} LOCAL.CODE {'/>'}
        </h1>
      </header>
      
      <div className="flex-1 overflow-hidden">
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
            <ChatPanel selectedFileId={selectedFileId} />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
