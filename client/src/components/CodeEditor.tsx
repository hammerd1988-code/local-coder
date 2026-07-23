import * as React from 'react';
import Editor from '@monaco-editor/react';

interface CodeEditorProps {
  selectedFileId: number | null;
}

interface FileData {
  id: number;
  path: string;
  content: string;
  language: string;
}

export default function CodeEditor({ selectedFileId }: CodeEditorProps) {
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
    } catch (error) {
      console.error('Error saving file:', error);
    }
  }

  function handleEditorChange(value: string | undefined) {
    const newContent = value || '';
    setContent(newContent);
    saveFile(newContent);
  }

  if (!file) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Select a file to edit
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
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true
        }}
      />
    </div>
  );
}
