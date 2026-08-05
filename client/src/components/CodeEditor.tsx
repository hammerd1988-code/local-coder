import * as React from 'react';
import Editor, { OnMount } from '@monaco-editor/react';

interface CodeEditorProps {
  selectedFileId: number | null;
  theme: string;
  applyRequest?: { code: string; nonce: number } | null;
}

interface FileData {
  id: number;
  path: string;
  content: string;
  language: string;
}

export default function CodeEditor({ selectedFileId, theme, applyRequest }: CodeEditorProps) {
  const [file, setFile] = React.useState<FileData | null>(null);
  const [content, setContent] = React.useState('');

  React.useEffect(() => {
    if (selectedFileId) {
      loadFile(selectedFileId);
    } else {
      setFile(null);
      setContent('');
    }
  }, [selectedFileId]);

  // Code applied from the chat panel replaces the open file's content
  React.useEffect(() => {
    if (applyRequest && file) {
      setContent(applyRequest.code);
      saveFile(applyRequest.code);
    }
  }, [applyRequest?.nonce]);

  async function loadFile(id: number) {
    try {
      const response = await fetch(`/api/files/${id}`);
      const data = await response.json();
      setFile(data);
      setContent(data.content);
    } catch (error) {
      console.error('Error loading file:', error);
    }
  }

  async function saveFile(newContent: string) {
    if (!file) return;

    try {
      await fetch(`/api/files/${file.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newContent,
          language: file.language
        })
      });
      // Lets the live preview reload immediately instead of waiting for its poll
      window.dispatchEvent(new Event('files-changed'));
    } catch (error) {
      console.error('Error saving file:', error);
    }
  }

  function handleEditorChange(value: string | undefined) {
    const newContent = value || '';
    setContent(newContent);
    saveFile(newContent);
  }

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    // Define custom cyberpunk theme
    monaco.editor.defineTheme('cyberpunk', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '00ff9f', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff00ff', fontStyle: 'bold' },
        { token: 'string', foreground: '00ffff' },
        { token: 'number', foreground: 'ff00ff' },
        { token: 'type', foreground: 'ffff00' },
        { token: 'function', foreground: 'ff0080' },
        { token: 'variable', foreground: '00ffff' },
        { token: 'identifier', foreground: '00ccff' },
      ],
      colors: {
        'editor.background': '#0a0e27',
        'editor.foreground': '#00ffff',
        'editor.lineHighlightBackground': '#1a1a3e',
        'editorCursor.foreground': '#ff00ff',
        'editor.selectionBackground': '#ff00ff40',
        'editor.inactiveSelectionBackground': '#ff00ff20',
        'editorLineNumber.foreground': '#00ff9f',
        'editorLineNumber.activeForeground': '#ff00ff',
        'editorIndentGuide.background': '#00ffff20',
        'editorIndentGuide.activeBackground': '#00ffff40',
      }
    });
  };

  if (!file) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-950 to-gray-900">
        <div className="text-center">
          <div className="text-cyan-400 text-lg font-mono mb-2">{'>'} Select a file to edit</div>
          <div className="text-purple-400/60 text-sm font-mono">No file loaded</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <Editor
        height="100%"
        language={file.language}
        value={content}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme={theme}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontLigatures: true,
        }}
      />
    </div>
  );
}
