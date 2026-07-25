import * as React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';
import { 
  Play, 
  Download, 
  Code, 
  Settings, 
  Terminal,
  Copy,
  CheckCircle2,
  Server,
  Cpu
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface DownloadedModel {
  id: number;
  model_id: string;
  model_name: string;
  model_type: string;
  size_mb: number | null;
  download_status: string;
  local_path: string | null;
  metadata: string;
}

interface ModelUsagePanelProps {
  model: DownloadedModel;
}

interface InferenceConfig {
  temperature: number;
  maxTokens: number;
  batchSize: number;
  topP: number;
  topK: number;
  repetitionPenalty: number;
}

export default function ModelUsagePanel({ model }: ModelUsagePanelProps) {
  const [config, setConfig] = React.useState<InferenceConfig>({
    temperature: 0.7,
    maxTokens: 512,
    batchSize: 1,
    topP: 0.9,
    topK: 50,
    repetitionPenalty: 1.0
  });

  const [wrapperType, setWrapperType] = React.useState<'python' | 'nodejs'>('python');
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);
  const [generatedMCP, setGeneratedMCP] = React.useState(false);

  function handleConfigChange(key: keyof InferenceConfig, value: number) {
    setConfig(prev => ({ ...prev, [key]: value }));
  }

  async function handleCopyCode(code: string, type: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(type);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  }

  async function handleGenerateMCP() {
    try {
      const response = await fetch('/api/huggingface/generate-mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: model.id,
          config
        })
      });

      if (response.ok) {
        setGeneratedMCP(true);
        setTimeout(() => setGeneratedMCP(false), 3000);
      }
    } catch (error) {
      console.error('Failed to generate MCP config:', error);
    }
  }

  const pythonCode = `from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

# Load model and tokenizer
model_path = "${model.local_path}"
tokenizer = AutoTokenizer.from_pretrained(model_path)
model = AutoModelForCausalLM.from_pretrained(
    model_path,
    torch_dtype=torch.float16,
    device_map="auto"
)

# Configure generation parameters
generation_config = {
    "temperature": ${config.temperature},
    "max_new_tokens": ${config.maxTokens},
    "top_p": ${config.topP},
    "top_k": ${config.topK},
    "repetition_penalty": ${config.repetitionPenalty},
    "do_sample": True,
}

# Generate text
def generate(prompt: str) -> str:
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    outputs = model.generate(**inputs, **generation_config)
    return tokenizer.decode(outputs[0], skip_special_tokens=True)

# Example usage
response = generate("Hello, how are you?")
print(response)
`;

  const nodejsCode = `const { pipeline } = require('@xenova/transformers');

// Load model from local path
const modelPath = "${model.local_path}";

async function loadModel() {
  const generator = await pipeline('${model.model_type}', modelPath, {
    quantized: true,
  });
  
  return generator;
}

// Configure generation parameters
const generationConfig = {
  temperature: ${config.temperature},
  max_new_tokens: ${config.maxTokens},
  top_p: ${config.topP},
  top_k: ${config.topK},
  repetition_penalty: ${config.repetitionPenalty},
};

// Generate text
async function generate(prompt) {
  const generator = await loadModel();
  const result = await generator(prompt, generationConfig);
  return result;
}

// Example usage
(async () => {
  const response = await generate("Hello, how are you?");
  console.log(response);
})();
`;

  const mcpServerConfig = `{
  "mcpServers": {
    "${model.model_name}": {
      "command": "python",
      "args": ["-m", "mcp_server_huggingface"],
      "env": {
        "MODEL_PATH": "${model.local_path}",
        "MODEL_ID": "${model.model_id}",
        "MODEL_TYPE": "${model.model_type}",
        "TEMPERATURE": "${config.temperature}",
        "MAX_TOKENS": "${config.maxTokens}",
        "TOP_P": "${config.topP}",
        "TOP_K": "${config.topK}",
        "REPETITION_PENALTY": "${config.repetitionPenalty}",
        "BATCH_SIZE": "${config.batchSize}"
      }
    }
  }
}`;

  const mcpServerPython = `# mcp_server_huggingface.py
import os
import json
from typing import Any
from mcp.server import Server
from mcp.server.stdio import stdio_server
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

# Load environment configuration
MODEL_PATH = os.getenv("MODEL_PATH")
MODEL_TYPE = os.getenv("MODEL_TYPE")
TEMPERATURE = float(os.getenv("TEMPERATURE", "0.7"))
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "512"))
TOP_P = float(os.getenv("TOP_P", "0.9"))
TOP_K = int(os.getenv("TOP_K", "50"))
REPETITION_PENALTY = float(os.getenv("REPETITION_PENALTY", "1.0"))

# Initialize model
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_PATH,
    torch_dtype=torch.float16,
    device_map="auto"
)

# Create MCP server
server = Server("huggingface-model")

@server.call_tool()
async def generate_text(arguments: dict[str, Any]) -> str:
    """Generate text using the loaded model"""
    prompt = arguments.get("prompt", "")
    
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    outputs = model.generate(
        **inputs,
        temperature=TEMPERATURE,
        max_new_tokens=MAX_TOKENS,
        top_p=TOP_P,
        top_k=TOP_K,
        repetition_penalty=REPETITION_PENALTY,
        do_sample=True
    )
    
    result = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return json.dumps({"response": result})

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
`;

  return (
    <div className="space-y-6">
      <Card className="bg-gray-900/50 border-cyan-500/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">Inference Configuration</h3>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-gray-300">Temperature</Label>
              <span className="text-sm text-cyan-400">{config.temperature}</span>
            </div>
            <Slider
              value={[config.temperature]}
              onValueChange={([value]) => handleConfigChange('temperature', value)}
              min={0}
              max={2}
              step={0.1}
              className="w-full"
            />
            <p className="text-xs text-gray-500">Controls randomness in generation</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-gray-300">Max Tokens</Label>
              <span className="text-sm text-cyan-400">{config.maxTokens}</span>
            </div>
            <Slider
              value={[config.maxTokens]}
              onValueChange={([value]) => handleConfigChange('maxTokens', value)}
              min={64}
              max={2048}
              step={64}
              className="w-full"
            />
            <p className="text-xs text-gray-500">Maximum number of tokens to generate</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-gray-300">Top P</Label>
              <span className="text-sm text-cyan-400">{config.topP}</span>
            </div>
            <Slider
              value={[config.topP]}
              onValueChange={([value]) => handleConfigChange('topP', value)}
              min={0}
              max={1}
              step={0.05}
              className="w-full"
            />
            <p className="text-xs text-gray-500">Nucleus sampling threshold</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-gray-300">Top K</Label>
              <span className="text-sm text-cyan-400">{config.topK}</span>
            </div>
            <Slider
              value={[config.topK]}
              onValueChange={([value]) => handleConfigChange('topK', value)}
              min={1}
              max={100}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-gray-500">Top-k sampling parameter</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-gray-300">Repetition Penalty</Label>
              <span className="text-sm text-cyan-400">{config.repetitionPenalty}</span>
            </div>
            <Slider
              value={[config.repetitionPenalty]}
              onValueChange={([value]) => handleConfigChange('repetitionPenalty', value)}
              min={0.5}
              max={2}
              step={0.1}
              className="w-full"
            />
            <p className="text-xs text-gray-500">Penalty for repeating tokens</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-gray-300">Batch Size</Label>
              <span className="text-sm text-cyan-400">{config.batchSize}</span>
            </div>
            <Slider
              value={[config.batchSize]}
              onValueChange={([value]) => handleConfigChange('batchSize', value)}
              min={1}
              max={8}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-gray-500">Number of parallel inferences</p>
          </div>
        </div>
      </Card>

      <Card className="bg-gray-900/50 border-cyan-500/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Code className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">Code Wrapper</h3>
        </div>

        <Tabs value={wrapperType} onValueChange={(v) => setWrapperType(v as 'python' | 'nodejs')}>
          <TabsList className="grid w-full grid-cols-2 bg-gray-800/50">
            <TabsTrigger value="python" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              <Terminal className="w-4 h-4 mr-2" />
              Python
            </TabsTrigger>
            <TabsTrigger value="nodejs" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              <Cpu className="w-4 h-4 mr-2" />
              Node.js
            </TabsTrigger>
          </TabsList>

          <TabsContent value="python" className="mt-4">
            <div className="relative">
              <pre className="bg-black/60 p-4 rounded-lg overflow-x-auto text-sm text-gray-300 border border-cyan-500/20">
                <code>{pythonCode}</code>
              </pre>
              <Button
                onClick={() => handleCopyCode(pythonCode, 'python')}
                size="sm"
                variant="outline"
                className="absolute top-2 right-2 bg-gray-900/80 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
              >
                {copiedCode === 'python' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Install dependencies: <code className="bg-black/40 px-1 py-0.5 rounded">pip install transformers torch</code>
            </p>
          </TabsContent>

          <TabsContent value="nodejs" className="mt-4">
            <div className="relative">
              <pre className="bg-black/60 p-4 rounded-lg overflow-x-auto text-sm text-gray-300 border border-cyan-500/20">
                <code>{nodejsCode}</code>
              </pre>
              <Button
                onClick={() => handleCopyCode(nodejsCode, 'nodejs')}
                size="sm"
                variant="outline"
                className="absolute top-2 right-2 bg-gray-900/80 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
              >
                {copiedCode === 'nodejs' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Install dependencies: <code className="bg-black/40 px-1 py-0.5 rounded">npm install @xenova/transformers</code>
            </p>
          </TabsContent>
        </Tabs>
      </Card>

      <Card className="bg-gray-900/50 border-cyan-500/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Server className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">MCP Server Configuration</h3>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-gray-300 mb-2 block">Config JSON</Label>
            <div className="relative">
              <pre className="bg-black/60 p-4 rounded-lg overflow-x-auto text-sm text-gray-300 border border-cyan-500/20">
                <code>{mcpServerConfig}</code>
              </pre>
              <Button
                onClick={() => handleCopyCode(mcpServerConfig, 'mcp-config')}
                size="sm"
                variant="outline"
                className="absolute top-2 right-2 bg-gray-900/80 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
              >
                {copiedCode === 'mcp-config' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-gray-300 mb-2 block">MCP Server Implementation (Python)</Label>
            <div className="relative">
              <pre className="bg-black/60 p-4 rounded-lg overflow-x-auto text-sm text-gray-300 border border-cyan-500/20 max-h-96">
                <code>{mcpServerPython}</code>
              </pre>
              <Button
                onClick={() => handleCopyCode(mcpServerPython, 'mcp-server')}
                size="sm"
                variant="outline"
                className="absolute top-2 right-2 bg-gray-900/80 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
              >
                {copiedCode === 'mcp-server' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Install MCP SDK: <code className="bg-black/40 px-1 py-0.5 rounded">pip install mcp</code>
            </p>
          </div>

          <Button
            onClick={handleGenerateMCP}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-black"
          >
            {generatedMCP ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Generated Successfully
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Generate MCP Server Files
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
