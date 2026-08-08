import * as React from 'react';
import { File, FolderOpen, Plus, Trash2 } from 'lucide-react';
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
  onSelectFile: (id: number | null) => void;
}

export default function FileExplorer({ selectedFileId, onSelectFile }: FileExplorerProps) {
  const [files, setFiles] = React.useState<FileItem[]>([]);
  const [newFilePath, setNewFilePath] = React.useState('');
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [workspaceRoot, setWorkspaceRoot] = React.useState<string | null>(null);
  const [workspaceMode, setWorkspaceMode] = React.useState<'disk' | 'database'>('database');
  const [folderDraft, setFolderDraft] = React.useState('');
  const [workspaceError, setWorkspaceError] = React.useState<string | null>(null);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = React.useState(false);

  React.useEffect(() => {
    loadWorkspace();
    loadFiles();
    const onFilesChanged = () => loadFiles();
    window.addEventListener('files-changed', onFilesChanged);
    return () => window.removeEventListener('files-changed', onFilesChanged);
  }, []);

  async function loadWorkspace() {
    try {
      const data = await (await fetch('/api/workspace')).json();
      setWorkspaceRoot(data.root);
      setWorkspaceMode(data.mode);
      setFolderDraft(data.root || '');
    } catch (error) {
      console.error('Error loading workspace:', error);
    }
  }

  async function loadFiles() {
    try {
      const response = await fetch('/api/files');
      const data = await response.json();
      setFiles(data);
    } catch (error) {
      console.error('Error loading files:', error);
    }
  }

  async function openWorkspace() {
    setWorkspaceError(null);
    try {
      const res = await fetch('/api/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: folderDraft.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWorkspaceError(data.error || 'Failed to open folder');
        return;
      }
      setWorkspaceRoot(data.root);
      setWorkspaceMode(data.mode);
      setIsWorkspaceOpen(false);
      onSelectFile(null);
      await loadFiles();
      window.dispatchEvent(new Event('files-changed'));
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Failed to open folder');
    }
  }

  async function clearWorkspace() {
    setFolderDraft('');
    setWorkspaceError(null);
    await fetch('/api/workspace', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root: null }),
    });
    setWorkspaceRoot(null);
    setWorkspaceMode('database');
    setIsWorkspaceOpen(false);
    await loadFiles();
    window.dispatchEvent(new Event('files-changed'));
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
    <div className="h-full flex flex-col bg-black/60 border-r border-cyan-500/30 backdrop-blur-sm">
      <div className="p-3 border-b border-cyan-500/30 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-cyan-400 font-mono">{'>'} Files</h2>
          <div className="flex gap-1">
        <Dialog open={isWorkspaceOpen} onOpenChange={setIsWorkspaceOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" title="Open folder on disk" className="hover:bg-burgundy-500/20 hover:text-burgundy-300">
              <FolderOpen className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-950 border-burgundy-500/50">
            <DialogHeader>
              <DialogTitle className="text-burgundy-300">Open workspace folder</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-purple-300/70 font-mono">
                Point Local Code at a real folder on this machine (Cursor-style). Git, Preview, and AI Apply will use that folder.
              </p>
              <div>
                <Label className="text-purple-300">Absolute path</Label>
                <Input
                  placeholder="C:\Users\you\projects\my-app"
                  value={folderDraft}
                  onChange={(e) => setFolderDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && openWorkspace()}
                  className="bg-black/40 border-burgundy-500/50 text-cyan-100 font-mono text-xs"
                />
              </div>
              {workspaceError && <p className="text-xs text-red-400 font-mono">{workspaceError}</p>}
              <div className="flex gap-2">
                <Button onClick={openWorkspace} className="flex-1 bg-gradient-to-r from-purple-600 to-burgundy-600">
                  Open folder
                </Button>
                <Button variant="ghost" onClick={clearWorkspace} className="text-gray-400 hover:text-cyan-300">
                  Use DB
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="hover:bg-cyan-500/20 hover:text-cyan-400">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-950 border-cyan-500/50">
            <DialogHeader>
              <DialogTitle className="text-cyan-400">New File</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="filepath" className="text-purple-300">File Path</Label>
                <Input
                  id="filepath"
                  placeholder="src/index.ts"
                  value={newFilePath}
                  onChange={(e) => setNewFilePath(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createFile()}
                  className="bg-black/40 border-cyan-500/50 text-cyan-100 focus:border-cyan-400"
                />
              </div>
              <Button onClick={createFile} className="w-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsWorkspaceOpen(true)}
          className="w-full text-left text-[10px] font-mono truncate px-1 text-burgundy-300/80 hover:text-burgundy-200"
          title={workspaceRoot || 'Using built-in database files'}
        >
          {workspaceMode === 'disk' && workspaceRoot
            ? workspaceRoot
            : 'workspace: database (open a folder)'}
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <div className="p-4 text-sm text-purple-400/60 text-center font-mono space-y-2">
            <p>No files yet.</p>
            <p className="text-xs">Open a folder on disk, or create a file.</p>
          </div>
        ) : (
          <div className="p-2">
            {files.map(file => (
              <div
                key={file.id}
                className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-cyan-500/20 group transition-colors ${
                  selectedFileId === file.id ? 'bg-cyan-500/30 border-l-2 border-cyan-400' : ''
                }`}
                onClick={() => onSelectFile(file.id)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <File className="h-4 w-4 flex-shrink-0 text-purple-400" />
                  <span className="text-sm truncate text-cyan-100 font-mono">{file.path}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400"
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
