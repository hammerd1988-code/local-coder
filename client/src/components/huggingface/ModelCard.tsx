import * as React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Download, Check, ThumbsUp, Database } from 'lucide-react';

interface HFModel {
  id: string;
  name: string;
  type: string;
  description: string;
  downloads: number;
  likes: number;
  size_mb: number;
  tags: string[];
}

interface ModelCardProps {
  model: HFModel;
  isDownloaded: boolean;
  onDownload: () => void;
}

export default function ModelCard({ model, isDownloaded, onDownload }: ModelCardProps) {
  function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  }

  function formatSize(mb: number): string {
    if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`;
    return `${mb} MB`;
  }

  return (
    <Card className="bg-gray-900/50 border-cyan-500/30 p-4 hover:border-cyan-500/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-white truncate">{model.name}</h3>
            <Badge variant="outline" className="text-xs border-cyan-500/50 text-cyan-400">
              {model.type}
            </Badge>
          </div>

          <p className="text-sm text-gray-400 mb-3 line-clamp-2">{model.description}</p>

          <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
            <div className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              <span>{formatNumber(model.downloads)}</span>
            </div>
            <div className="flex items-center gap-1">
              <ThumbsUp className="w-3 h-3" />
              <span>{formatNumber(model.likes)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Database className="w-3 h-3" />
              <span>{formatSize(model.size_mb)}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {model.tags.slice(0, 3).map(tag => (
              <Badge key={tag} variant="outline" className="text-xs border-gray-700 text-gray-400">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <Button
          onClick={onDownload}
          disabled={isDownloaded}
          size="sm"
          className={isDownloaded 
            ? "bg-green-500/20 text-green-400 hover:bg-green-500/20 cursor-default" 
            : "bg-cyan-500 hover:bg-cyan-600 text-black"
          }
        >
          {isDownloaded ? (
            <>
              <Check className="w-4 h-4 mr-1" />
              Downloaded
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-1" />
              Download
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
