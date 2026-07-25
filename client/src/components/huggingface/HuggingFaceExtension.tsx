import * as React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Search, Download, Trash2, Check, Loader2, Database, Box } from 'lucide-react';
import ModelCard from './ModelCard';
import MyModelsPanel from './MyModelsPanel';

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

interface ModelType {
  value: string;
  label: string;
}

export default function HuggingFaceExtension() {
  const [activeTab, setActiveTab] = React.useState('browse');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedType, setSelectedType] = React.useState('all');
  const [modelTypes, setModelTypes] = React.useState<ModelType[]>([]);
  const [searchResults, setSearchResults] = React.useState<HFModel[]>([]);
  const [myModels, setMyModels] = React.useState<DownloadedModel[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedModel, setSelectedModel] = React.useState<DownloadedModel | null>(null);

  // Fetch model types on mount
  React.useEffect(() => {
    fetchModelTypes();
    fetchMyModels();
  }, []);

  async function fetchModelTypes() {
    try {
      const response = await fetch('/api/huggingface/types');
      const data = await response.json();
      setModelTypes(data);
    } catch (error) {
      console.error('Error fetching model types:', error);
    }
  }

  async function fetchMyModels() {
    try {
      const response = await fetch('/api/huggingface/models');
      const data = await response.json();
      setMyModels(data);
    } catch (error) {
      console.error('Error fetching my models:', error);
    }
  }

  async function handleSearch() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('query', searchQuery);
      if (selectedType !== 'all') params.append('type', selectedType);
      params.append('limit', '20');

      const response = await fetch(`/api/huggingface/search?${params}`);
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Error searching models:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(model: HFModel) {
    try {
      const response = await fetch('/api/huggingface/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: model.id,
          model_name: model.name,
          model_type: model.type,
          size_mb: model.size_mb,
          metadata: {
            description: model.description,
            tags: model.tags,
            downloads: model.downloads,
            likes: model.likes
          }
        })
      });

      if (response.ok) {
        // Refresh models list
        setTimeout(() => fetchMyModels(), 1000);
        setActiveTab('my-models');
      }
    } catch (error) {
      console.error('Error downloading model:', error);
    }
  }

  async function handleDelete(modelId: number) {
    try {
      const response = await fetch(`/api/huggingface/models/${modelId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchMyModels();
        setSelectedModel(null);
      }
    } catch (error) {
      console.error('Error deleting model:', error);
    }
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }

  const downloadedModelIds = myModels.map(m => m.model_id);

  return (
    <div className="h-full flex flex-col bg-gray-950">
      <div className="border-b border-cyan-500/30 bg-black/40 backdrop-blur-sm p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
            <span className="text-2xl">🤗</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Hugging Face</h2>
            <p className="text-xs text-gray-400">Browse and download AI models</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 bg-gray-900/50">
            <TabsTrigger value="browse" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              <Search className="w-4 h-4 mr-2" />
              Browse Models
            </TabsTrigger>
            <TabsTrigger value="my-models" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              <Database className="w-4 h-4 mr-2" />
              My Models ({myModels.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="browse" className="mt-0 p-4">
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1 bg-gray-900/50 border-cyan-500/30 text-white"
                />
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="bg-gray-900/50 border border-cyan-500/30 rounded px-3 py-2 text-white text-sm"
                >
                  {modelTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                <Button
                  onClick={handleSearch}
                  disabled={loading}
                  className="bg-cyan-500 hover:bg-cyan-600 text-black"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>

              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                </div>
              )}

              {!loading && searchResults.length === 0 && (
                <div className="text-center py-12">
                  <Box className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">Search for models to get started</p>
                  <p className="text-sm text-gray-500 mt-1">Try searching for "llama", "whisper", or "stable-diffusion"</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3">
                {searchResults.map(model => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    isDownloaded={downloadedModelIds.includes(model.id)}
                    onDownload={() => handleDownload(model)}
                  />
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="my-models" className="mt-0 p-4">
            <MyModelsPanel
              models={myModels}
              selectedModel={selectedModel}
              onSelectModel={setSelectedModel}
              onDeleteModel={handleDelete}
              onRefresh={fetchMyModels}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
