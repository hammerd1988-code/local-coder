import * as React from 'react';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface FileItem {
  id: number;
  path: string;
}

export default function PreviewPanel() {
  const [htmlFiles, setHtmlFiles] = React.useState<FileItem[]>([]);
  const [entryPath, setEntryPath] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;

    async function loadHtmlFiles() {
      try {
        const response = await fetch('/api/files');
        const files: FileItem[] = await response.json();
        if (cancelled) return;
        const html = files.filter((f) => /\.html?$/i.test(f.path));
        setHtmlFiles(html);
        setEntryPath((current) => {
          if (current && html.some((f) => f.path === current)) return current;
          const index = html.find((f) => /(^|\/)index\.html?$/i.test(f.path));
          return index?.path ?? html[0]?.path ?? null;
        });
      } catch (error) {
        console.error('Error loading files for preview:', error);
      }
    }

    let lastVersion = '';
    async function checkVersion() {
      try {
        const response = await fetch('/api/preview/version');
        const data = await response.json();
        if (cancelled) return;
        if (data.version !== lastVersion) {
          lastVersion = data.version;
          setVersion(data.version);
          loadHtmlFiles();
        }
      } catch {
        // Server briefly unreachable (e.g. dev restart) - keep last version
      }
    }

    checkVersion();

    // Same-tab saves notify instantly; polling catches everything else
    // (chat-applied code, git operations, other tabs).
    const onFilesChanged = () => checkVersion();
    window.addEventListener('files-changed', onFilesChanged);
    const timer = setInterval(checkVersion, 2000);

    return () => {
      cancelled = true;
      window.removeEventListener('files-changed', onFilesChanged);
      clearInterval(timer);
    };
  }, []);

  const src = entryPath
    ? `/api/preview/${entryPath}?v=${encodeURIComponent(version)}`
    : null;

  return (
    <div className="h-full flex flex-col bg-black/60 backdrop-blur-sm">
      <div className="p-2 border-b border-burgundy-500/50 flex items-center gap-2">
        <h2 className="font-semibold text-burgundy-300 font-mono text-sm shrink-0 px-2">{'>'} Preview</h2>
        <Select value={entryPath ?? ''} onValueChange={setEntryPath}>
          <SelectTrigger className="h-8 flex-1 bg-black/40 border-burgundy-500/50 text-cyan-100 text-xs font-mono">
            <SelectValue placeholder="No HTML files yet" />
          </SelectTrigger>
          <SelectContent className="bg-gray-950 border-burgundy-500/50 text-cyan-100 font-mono">
            {htmlFiles.map((f) => (
              <SelectItem key={f.id} value={f.path}>{f.path}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setVersion(`manual-${Date.now()}`)}
          title="Reload preview"
          className="h-8 w-8 p-0 text-burgundy-300 hover:bg-burgundy-600/25"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => entryPath && window.open(`/api/preview/${entryPath}`, '_blank')}
          disabled={!entryPath}
          title="Open in new tab"
          className="h-8 w-8 p-0 text-burgundy-300 hover:bg-burgundy-600/25 disabled:opacity-40"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>

      {src ? (
        <iframe
          key={src}
          src={src}
          title="Live preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
          className="flex-1 w-full bg-white"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-center p-6">
          <div className="font-mono text-sm space-y-2">
            <p className="text-burgundy-300">No HTML file to preview yet</p>
            <p className="text-purple-400/60 text-xs">
              Create an index.html (or ask the AI to build one) and it will render here live.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
