import * as React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Trash2, Check, Loader2, Database, Play, RefreshCw, Box, Settings } from 'lucide-react';
import ModelUsagePanel from './ModelUsagePanel';

interface DownloadedModel {
  id: number;
  model_id: string;
  model_name: string;
  model_type: string;
  size_mb: number | null;
  download_status: 'pending' | 'downloading' | 'completed' | 'failed';
  download_progress: number | null;
  local_path: string | null;
  metadata: string;
  downloaded_at: number | null;
  created_at: number;
  updated_at: number;
}

interface MyModelsPanelProps {
  models: DownloadedModel[];
  selectedModel: DownloadedModel | null;
  onSelectModel: (model: DownloadedModel) => void;
  onDeleteModel: (modelId: number) => void;
  onRefresh: () => void;
}

type ViewMode = 'list' | 'usage';

export default function MyModelsPanel({ 
  models, 
  selectedModel, 
  onSelectModel, 
  onDeleteModel,
  onRefresh 
}: MyModelsPanelProps) {
  const [viewMode, setViewMode] = React.useState<ViewMode>('list');

  function formatDate(timestamp: number | null): string {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString();
  }

  function formatSize(mb: number | null): string {
    if (!mb) return 'N/A';
    if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`;
    return `${mb} MB`;
  }

  function handleUseModel(model: DownloadedModel) {
    onSelectModel(model);
    setViewMode('usage');
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Completed</Badge>;
      case 'downloading':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">Downloading...</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/50">Failed</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">Pending</Badge>;
    }
  }

  const completedModels = models.filter(m => m.download_status === 'completed');
  const downloadingModels = models.filter(m => m.download_status === 'downloading' || m.download_status === 'pending');

  if (models.length === 0) {
    return (
      <div className="text-center py-12">
        <Box className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 mb-2">No models downloaded yet</p>
        <p className="text-sm text-gray-500">Browse and download models to get started</p>
      </div>
    );
  }

  // Show usage panel if a model is selected and in usage mode
  if (viewMode === 'usage' && selectedModel) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Button
              onClick={() => setViewMode('list')}
              size="sm"
              variant="ghost"
              className="text-cyan-400 hover:text-cyan-300 mb-2"
            >
              ← Back to Models
            </Button>
            <h3 className="text-lg font-semibold text-white">{selectedModel.model_name}</h3>
            <p className="text-sm text-gray-400">{selectedModel.model_id}</p>
          </div>
          <Button
            onClick={onRefresh}
            size="sm"
            variant="ghost"
            className="text-cyan-400 hover:text-cyan-300"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
        <ModelUsagePanel model={selectedModel} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-cyan-400">Downloaded Models</h3>
        <Button
          onClick={onRefresh}
          size="sm"
          variant="ghost"
          className="text-cyan-400 hover:text-cyan-300"
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
      </div>

      {downloadingModels.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-400 uppercase">In Progress</h4>
          {downloadingModels.map(model => (
            <Card key={model.id} className="bg-gray-900/50 border-cyan-500/30 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                    <span className="font-medium text-white truncate">{model.model_name}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{model.model_type}</p>
                </div>
                {getStatusBadge(model.download_status)}
              </div>
              {model.download_progress !== null && (
                <Progress value={model.download_progress} className="h-1" />
              )}
            </Card>
          ))}
        </div>
      )}

      {completedModels.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-400 uppercase">Available Models</h4>
          {completedModels.map(model => {
            const isSelected = selectedModel?.id === model.id;
            return (
              <Card 
                key={model.id} 
                className={`bg-gray-900/50 border-cyan-500/30 p-3 cursor-pointer transition-all ${
                  isSelected ? 'ring-2 ring-cyan-500 border-cyan-500' : 'hover:border-cyan-500/50'
                }`}
                onClick={() => onSelectModel(model)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Database className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      <span className="font-medium text-white truncate">{model.model_name}</span>
                      {isSelected && <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs border-cyan-500/50 text-cyan-400">
                        {model.model_type}
                      </Badge>
                      {getStatusBadge(model.download_status)}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Size: {formatSize(model.size_mb)}</span>
                      <span>Downloaded: {formatDate(model.downloaded_at)}</span>
                    </div>

                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-gray-800">
                        <p className="text-xs text-gray-400 mb-2">Model ID:</p>
                        <code className="text-xs text-cyan-400 bg-black/40 px-2 py-1 rounded block overflow-x-auto">
                          {model.model_id}
                        </code>
                        {model.local_path && (
                          <>
                            <p className="text-xs text-gray-400 mb-2 mt-3">Local Path:</p>
                            <code className="text-xs text-gray-400 bg-black/40 px-2 py-1 rounded block overflow-x-auto">
                              {model.local_path}
                            </code>
                          </>
                        )}
                        <div className="flex gap-2 mt-3">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUseModel(model);
                            }}
                            size="sm"
                            className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-black"
                          >
                            <Settings className="w-4 h-4 mr-1" />
                            Configure & Use
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteModel(model.id);
                            }}
                            size="sm"
                            variant="outline"
                            className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
