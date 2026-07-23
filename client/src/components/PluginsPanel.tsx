import * as React from "react";
import { Switch } from "./ui/switch";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Label } from "./ui/label";

interface Plugin {
  id: number;
  name: string;
  enabled: boolean;
  config: Record<string, any>;
}

export default function PluginsPanel() {
  const [plugins, setPlugins] = React.useState<Plugin[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadPlugins();
  }, []);

  async function loadPlugins() {
    try {
      const response = await fetch("/api/plugins");
      const data = await response.json();
      setPlugins(data);
    } catch (error) {
      console.error("Error loading plugins:", error);
    } finally {
      setLoading(false);
    }
  }

  async function togglePlugin(id: number) {
    try {
      const response = await fetch(`/api/plugins/${id}/toggle`, {
        method: "PUT"
      });
      const { enabled } = await response.json();
      
      setPlugins(prev => 
        prev.map(p => p.id === id ? { ...p, enabled } : p)
      );
    } catch (error) {
      console.error("Error toggling plugin:", error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-black/40">
        <div className="text-cyan-400 animate-pulse">Loading plugins...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black/40 backdrop-blur-sm border-l border-cyan-500/30">
      <div className="p-4 border-b border-cyan-500/30">
        <h2 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          PLUGINS
        </h2>
      </div>
      
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {plugins.map((plugin) => (
          <Card 
            key={plugin.id}
            className="p-4 bg-gray-950/80 border-cyan-500/30 hover:border-cyan-400/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-cyan-300 font-mono uppercase text-sm">
                  {plugin.name}
                </Label>
                {plugin.name === "ollama" && (
                  <p className="text-xs text-purple-400 mt-1">
                    Model: {plugin.config.model || "codellama"}
                  </p>
                )}
                {plugin.name === "prettier" && (
                  <p className="text-xs text-purple-400 mt-1">
                    Auto format on save
                  </p>
                )}
                {plugin.name === "eslint" && (
                  <p className="text-xs text-purple-400 mt-1">
                    Auto fix enabled
                  </p>
                )}
              </div>
              
              <Switch
                checked={plugin.enabled}
                onCheckedChange={() => togglePlugin(plugin.id)}
                className="data-[state=checked]:bg-cyan-500"
              />
            </div>
          </Card>
        ))}
      </div>
      
      <div className="p-4 border-t border-cyan-500/30">
        <Button 
          variant="outline" 
          className="w-full border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400"
        >
          + ADD PLUGIN
        </Button>
      </div>
    </div>
  );
}
