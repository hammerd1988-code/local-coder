import * as React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import FileExplorer from '../components/FileExplorer';
import CodeEditor from '../components/CodeEditor';
import ChatPanel from '../components/ChatPanel';

export default function EditorPage() {
  const [selectedFileId, setSelectedFileId] = React.useState<number | null>(null);

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="h-12 border-b flex items-center px-4 bg-background">
        <h1 className="text-lg font-semibold">Local Code Editor</h1>
      </header>
      
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          <Panel defaultSize={20} minSize={15} maxSize={30}>
            <FileExplorer 
              selectedFileId={selectedFileId}
              onSelectFile={setSelectedFileId}
            />
          </Panel>
          
          <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors" />
          
          <Panel defaultSize={50} minSize={30}>
            <CodeEditor selectedFileId={selectedFileId} />
          </Panel>
          
          <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors" />
          
          <Panel defaultSize={30} minSize={20} maxSize={50}>
            <ChatPanel selectedFileId={selectedFileId} />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
