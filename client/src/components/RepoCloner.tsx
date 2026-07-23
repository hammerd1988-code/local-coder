import * as React from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Progress } from './ui/progress';

export default function RepoCloner() {
  const [open, setOpen] = React.useState(false);
  const [repoUrl, setRepoUrl] = React.useState('');
  const [targetDir, setTargetDir] = React.useState('');
  const [cloning, setCloning] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [message, setMessage] = React.useState('');

  async function handleClone() {
    if (!repoUrl) {
      setMessage('Repository URL is required');
      return;
    }

    setCloning(true);
    setProgress(0);
    setMessage('Cloning repository...');

    try {
      const response = await fetch('/api/git/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: repoUrl,
          targetDir: targetDir || undefined
        })
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(Boolean);

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.progress !== undefined) {
                setProgress(data.progress);
              }
              if (data.message) {
                setMessage(data.message);
              }
              if (data.error) {
                setMessage(`Error: ${data.error}`);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

      setMessage('Repository cloned successfully!');
      setTimeout(() => {
        setOpen(false);
        setRepoUrl('');
        setTargetDir('');
        setProgress(0);
        setMessage('');
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Clone error:', error);
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCloning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          className="text-xs font-mono text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 border border-cyan-500/30"
        >
          CLONE REPO
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gradient-to-br from-gray-950 via-purple-950/40 to-cyan-950/40 border-2 border-cyan-500/50 shadow-2xl shadow-cyan-500/20">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Clone Git Repository
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="repo-url" className="text-cyan-300 font-mono text-sm">
              Repository URL
            </Label>
            <Input
              id="repo-url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/user/repo.git"
              disabled={cloning}
              className="bg-black/50 border-cyan-500/30 text-cyan-100 placeholder:text-gray-500 focus:border-purple-400 font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-dir" className="text-cyan-300 font-mono text-sm">
              Target Directory (optional)
            </Label>
            <Input
              id="target-dir"
              value={targetDir}
              onChange={(e) => setTargetDir(e.target.value)}
              placeholder="my-project"
              disabled={cloning}
              className="bg-black/50 border-cyan-500/30 text-cyan-100 placeholder:text-gray-500 focus:border-purple-400 font-mono"
            />
          </div>

          {cloning && (
            <div className="space-y-2">
              <Progress 
                value={progress} 
                className="h-2 bg-black/50"
              />
              <p className="text-xs text-cyan-400 font-mono">{message}</p>
            </div>
          )}

          {!cloning && message && (
            <p className="text-xs text-purple-400 font-mono">{message}</p>
          )}

          <Button
            onClick={handleClone}
            disabled={cloning || !repoUrl}
            className="w-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-mono border border-cyan-400/50 shadow-lg shadow-cyan-500/20"
          >
            {cloning ? 'CLONING...' : 'CLONE REPOSITORY'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
