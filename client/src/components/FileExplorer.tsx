import * as React from 'react';
import { File, Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';

interface FileItem {
  id: number;
  path: string;
  content: string;
  language: string;
}

interface FileExplorerProps {
  selectedFileId: number | null;
  onSelectFile: (id: number) => void;
}

export default function FileExplorer({ selectedFileId, onSelectFile }: FileExplorerProps) {
  const [files, setFiles] = React.useState<FileItem[]>([]);
  const [newFilePath, setNewFilePath] = React.useState('');
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  React.useEffect(() => {
    loadFiles();
  }, []);

  async function loadFiles() {
    try {
      const response = await fetch('/api/files');
      const data = await response.json();
      setFiles(data);
    } catch (error) {
      console.error('Error loading files:', error);
    }
  }

  async function createFile() {
    if (!newFilePath.trim()) return;

    try {
      const language = getLanguageFromPath(newFilePath);
      const response = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          path: newFilePath,
          content: '',
          language
        })
      });
      
      const newFile = await response.json();
      setFiles([...files, newFile]);
      setNewFilePath('');
      setIsDialogOpen(false);
      onSelectFile(newFile.id);
    } catch (error) {
      console.error('Error creating file:', error);
    }
  }

  async function deleteFile(id: number) {
    try {
      await fetch(`/api/files/${id}`, { method: 'DELETE' });
      setFiles(files.filter(f => f.id !== id));
      if (selectedFileId === id) {
        onSelectFile(files[0]?.id || null);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }

  function getLanguageFromPath(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'py': 'python',
      'rs': 'rust',
      'go': 'go',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'md': 'markdown'
    };
    return langMap[ext || ''] || 'plaintext';
  }

  return (
    <div className="h-full flex flex-col bg-background border-r">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold">Files</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New File</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="filepath">File Path</Label>
                <Input
                  id="filepath"
                  placeholder="src/index.ts"
                  value={newFilePath}
                  onChange={(e) => setNewFilePath(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createFile()}
                />
              </div>
              <Button onClick={createFile} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            No files yet. Create one to get started.
          </div>
        ) : (
          <div className="p-2">
            {files.map(file => (
              <div
                key={file.id}
                className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-accent group ${
                  selectedFileId === file.id ? 'bg-accent' : ''
                }`}
                onClick={() => onSelectFile(file.id)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <File className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm truncate">{file.path}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteFile(file.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
