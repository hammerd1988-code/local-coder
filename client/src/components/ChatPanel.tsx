import * as React from 'react';
import { Send, Settings, Trash2, Square, Copy, Check, FileCode2, Mic, Workflow } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { CASPER_NAME } from '../lib/casper';
import { DEFAULT_WORKFLOW_ID, WORKFLOWS, getWorkflow } from '../lib/workflows';

interface Message {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
}

interface ProviderModels {
  provider: string;
  models: string[];
}

/** Sentinel telling the server to use whichever model the provider has loaded. */
const AUTO_MODEL = 'auto';

interface ChatPanelProps {
  selectedFileId: number | null;
  onApplyCode?: (code: string) => void;
  onApplyMany?: (files: { path: string; content: string }[]) => void;
}

const STREAMING_ID = -1;
const MAX_CONTEXT_CHARS = 12000;

/** Split message text into alternating prose and fenced code segments. */
function splitCodeBlocks(text: string) {
  const segments: { type: 'text' | 'code'; content: string; language?: string }[] = [];
  const regex = /```(\w*)\n?([\s\S]*?)(?:```|$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'code', content: match[2].replace(/\n$/, ''), language: match[1] || undefined });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }
  return segments;
}

function CodeBlock({ code, language, canApply, onApply }: {
  code: string;
  language?: string;
  canApply: boolean;
  onApply?: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error('Clipboard write failed:', error);
    }
  }

  return (
    <div className="my-2 rounded border border-burgundy-500/60 overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1 bg-burgundy-900/70 border-b border-burgundy-500/60">
        <span className="text-[10px] uppercase tracking-wider text-burgundy-300">{language || 'code'}</span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={copy}
            className="h-5 px-1.5 text-[10px] text-cyan-300 hover:bg-cyan-500/20">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
          {onApply && (
            <Button size="sm" variant="ghost" onClick={onApply}
              title={canApply
                ? 'Apply to open file (or create path from first-line comment)'
                : 'Create/update file from first-line path comment, or open a file first'}
              className="h-5 px-1.5 text-[10px] text-purple-300 hover:bg-purple-500/20">
              <FileCode2 className="h-3 w-3 mr-1" /> Apply
            </Button>
          )}
        </div>
      </div>
      <pre className="p-2 text-xs overflow-x-auto bg-black/70 text-cyan-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function extractPathedBlocks(text: string): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];
  const regex = /```(?:\w*)\n?([\s\S]*?)(?:```|$)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const raw = match[1].replace(/\n$/, '');
    const first = raw.split('\n')[0] ?? '';
    const pathMatch = first.match(/^(?:\/\/|#|\/\*|;|<!--)\s*([A-Za-z0-9_./\\-]+\.[A-Za-z0-9]+)/);
    if (!pathMatch) continue;
    const path = pathMatch[1].replace(/\\/g, '/');
    const content = raw.replace(/^[^\n]*\n?/, '');
    files.push({ path, content });
  }
  return files;
}

export default function ChatPanel({ selectedFileId, onApplyCode, onApplyMany }: ChatPanelProps) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [includeFile, setIncludeFile] = React.useState(true);
  const [contextPath, setContextPath] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState({
    model_provider: 'lmstudio',
    model_name: AUTO_MODEL,
    ollama_base_url: 'http://localhost:11434',
    lmstudio_base_url: 'http://localhost:1234',
    lmstudio_api_key: '',
    bsc_license_key: '',
    chat_workflow: DEFAULT_WORKFLOW_ID,
  });
  const [licenseStatus, setLicenseStatus] = React.useState<{ linked: boolean; valid: boolean; tier: string; error?: string } | null>(null);
  const [workflowId, setWorkflowId] = React.useState(DEFAULT_WORKFLOW_ID);
  const workflow = getWorkflow(workflowId);
  const [availableModels, setAvailableModels] = React.useState<ProviderModels[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const [isListening, setIsListening] = React.useState(false);
  const [micError, setMicError] = React.useState<string | null>(null);
  const recognitionRef = React.useRef<any>(null);
  // Input text present before dictation started, so speech appends instead of replacing
  const preSpeechInputRef = React.useRef('');
  const speechSupported = React.useMemo(
    () => !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition),
    []
  );

  React.useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  function toggleMic() {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    setMicError(null);
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    preSpeechInputRef.current = input;

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(`${preSpeechInputRef.current} ${transcript}`.trimStart());
    };
    recognition.onerror = (event: any) => {
      const reasons: Record<string, string> = {
        'not-allowed': 'Microphone access denied — allow it in browser site settings',
        'audio-capture': 'No microphone found',
        'network': 'Speech service unreachable (this browser transcribes online)',
        'no-speech': 'No speech detected'
      };
      setMicError(reasons[event.error] ?? `Speech recognition error: ${event.error}`);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  React.useEffect(() => {
    loadMessages();
    loadSettings();
  }, []);

  React.useEffect(() => {
    if (isSettingsOpen) {
      loadModels();
      loadLicenseStatus();
    }
  }, [isSettingsOpen]);

  async function loadLicenseStatus() {
    try {
      const response = await fetch('/api/license/status');
      setLicenseStatus(await response.json());
    } catch {
      setLicenseStatus(null);
    }
  }

  React.useEffect(() => {
    if (!selectedFileId) {
      setContextPath(null);
      return;
    }
    fetch(`/api/files/${selectedFileId}`)
      .then((r) => r.json())
      .then((f) => setContextPath(f.path))
      .catch(() => setContextPath(null));
  }, [selectedFileId]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMessages() {
    try {
      const response = await fetch('/api/chat/messages');
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }

  async function loadSettings() {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      setSettings((prev) => ({ ...prev, ...data, model_name: data.model_name?.trim() || AUTO_MODEL }));
      if (data.chat_workflow) setWorkflowId(data.chat_workflow);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async function selectWorkflow(id: string) {
    setWorkflowId(id);
    setSettings((prev) => ({ ...prev, chat_workflow: id }));
    try {
      await fetch('/api/settings/chat_workflow', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: id }),
      });
    } catch (error) {
      console.error('Error saving workflow:', error);
    }
  }

  async function loadModels() {
    try {
      const response = await fetch('/api/chat/models');
      setAvailableModels(await response.json());
    } catch (error) {
      console.error('Error loading models:', error);
    }
  }

  async function saveSettings() {
    try {
      for (const key of ['model_provider', 'model_name', 'ollama_base_url', 'lmstudio_base_url', 'lmstudio_api_key', 'bsc_license_key'] as const) {
        await fetch(`/api/settings/${key}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: settings[key] })
        });
      }
      await loadLicenseStatus();
      setIsSettingsOpen(false);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  async function buildSystemMessage(): Promise<{ role: 'system'; content: string }> {
    const parts: string[] = [workflow.systemPrompt];
    const mode = workflow.contextMode;

    if (mode === 'project' || mode === 'file') {
      try {
        const listRes = await fetch('/api/files');
        const files: { id: number; path: string }[] = await listRes.json();

        if (mode === 'project') {
          const paths = files.map((f) => f.path).sort();
          const tree = paths.slice(0, 500).join('\n') + (paths.length > 500 ? `\n…(${paths.length - 500} more)` : '');
          parts.push(`Workspace files:\n${tree}`);
        }

        // Project rules file (Cursor-style)
        const rulesMeta = files.find((f) =>
          f.path === '.localcoderules' || f.path === '.cursorrules' || f.path.endsWith('/.localcoderules')
        );
        if (rulesMeta) {
          try {
            const rules = await (await fetch(`/api/files/${rulesMeta.id}`)).json();
            if (rules.content?.trim()) {
              parts.push(`Project rules (.localcoderules):\n${rules.content.slice(0, 8000)}`);
            }
          } catch {
            // optional
          }
        }

        if (includeFile && selectedFileId) {
          const response = await fetch(`/api/files/${selectedFileId}`);
          const file = await response.json();
          const truncated = file.content.length > MAX_CONTEXT_CHARS;
          const snippet = truncated
            ? file.content.slice(0, MAX_CONTEXT_CHARS) + '\n/* ...truncated... */'
            : file.content;
          parts.push(
            `Open file "${file.path}":\n\`\`\`${file.language || ''}\n${snippet}\n\`\`\`\nWhen the user refers to "this file", they mean that file.`
          );
        } else if (mode === 'file') {
          parts.push('No file is open. If the task needs code, ask the user to open or create a file.');
        }
      } catch (error) {
        console.error('Error building workflow context:', error);
      }
    }

    return { role: 'system', content: parts.join('\n\n') };
  }

  function updateStreaming(updater: (m: Message) => Message) {
    setMessages((prev) => prev.map((m) => (m.id === STREAMING_ID ? updater(m) : m)));
  }

  async function persistMessage(role: string, content: string): Promise<Message | null> {
    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content })
      });
      return await response.json();
    } catch (error) {
      console.error('Error saving message:', error);
      return null;
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
  }

  async function sendMessage() {
    if (!input.trim() || isLoading) return;

    recognitionRef.current?.stop();
    const userMessage = input;
    setInput('');
    setIsLoading(true);

    let content = '';
    let reasoning = '';

    try {
      const savedUserMsg = await persistMessage('user', userMessage);
      if (savedUserMsg) setMessages((prev) => [...prev, savedUserMsg]);

      const systemMessage = await buildSystemMessage();
      const history = [...messages, { role: 'user' as const, content: userMessage }]
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content }));
      const chatMessages = [systemMessage, ...history];

      // Placeholder that fills in as tokens stream back
      setMessages((prev) => [...prev, { id: STREAMING_ID, role: 'assistant', content: '', reasoning: '' }]);

      abortRef.current = new AbortController();
      const response = await fetch('/api/chat/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatMessages, model: settings.model_name }),
        signal: abortRef.current.signal
      });

      if (!response.body) throw new Error('No response stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamError: string | null = null;

      streaming:
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep: number;
        while ((sep = buffer.indexOf('\n\n')) >= 0) {
          const raw = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          if (!raw.startsWith('data: ')) continue;
          const event = JSON.parse(raw.slice(6));

          if (event.type === 'content') {
            content += event.delta;
            updateStreaming((m) => ({ ...m, content }));
          } else if (event.type === 'reasoning') {
            reasoning += event.delta;
            updateStreaming((m) => ({ ...m, reasoning }));
          } else if (event.type === 'error') {
            streamError = event.message;
            break streaming;
          } else if (event.type === 'done') {
            break streaming;
          }
        }
      }

      if (streamError) {
        updateStreaming((m) => ({ ...m, content: `⚠ ${streamError}` }));
        return;
      }

      await finalize(content, reasoning);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        await finalize(content, reasoning);
      } else {
        console.error('Error sending message:', error);
        updateStreaming((m) => ({ ...m, content: m.content || '⚠ Failed to reach the model provider' }));
      }
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  }

  async function finalize(content: string, reasoning: string) {
    // Reasoning models may put everything in the thinking channel
    const finalContent = content.trim() ? content : reasoning;
    if (!finalContent.trim()) {
      setMessages((prev) => prev.filter((m) => m.id !== STREAMING_ID));
      return;
    }
    const saved = await persistMessage('assistant', finalContent);
    setMessages((prev) =>
      prev.map((m) => (m.id === STREAMING_ID
        ? { ...(saved ?? m), id: saved?.id ?? m.id, content: finalContent, reasoning }
        : m))
    );
  }

  async function clearChat() {
    try {
      await fetch('/api/chat/messages', { method: 'DELETE' });
      setMessages([]);
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  }

  const providerModels = availableModels.find((p) => p.provider === settings.model_provider)?.models ?? [];

  return (
    <div className="h-full flex flex-col bg-black/60 backdrop-blur-sm">
      <div className="p-3 border-b border-cyan-500/30 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-purple-400 font-mono shrink-0">{'>'} {CASPER_NAME}</h2>
          <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={clearChat} className="hover:bg-red-500/20 hover:text-red-400">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" className="hover:bg-cyan-500/20 hover:text-cyan-400">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-950 border-cyan-500/50">
              <DialogHeader>
                <DialogTitle className="text-cyan-400">Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-purple-300">Provider</Label>
                  <Select
                    value={settings.model_provider}
                    onValueChange={(value) => setSettings({ ...settings, model_provider: value })}
                  >
                    <SelectTrigger className="bg-black/40 border-cyan-500/50 text-cyan-100">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-950 border-cyan-500/50 text-cyan-100">
                      <SelectItem value="lmstudio">LM Studio</SelectItem>
                      <SelectItem value="ollama">Ollama</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-purple-300">Model</Label>
                  {providerModels.length > 0 ? (
                    <Select
                      value={settings.model_name}
                      onValueChange={(value) => setSettings({ ...settings, model_name: value })}
                    >
                      <SelectTrigger className="bg-black/40 border-cyan-500/50 text-cyan-100">
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-950 border-cyan-500/50 text-cyan-100">
                        <SelectItem value={AUTO_MODEL}>Auto — whatever is loaded</SelectItem>
                        {providerModels.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <>
                      <Input
                        value={settings.model_name}
                        onChange={(e) => setSettings({ ...settings, model_name: e.target.value })}
                        className="bg-black/40 border-cyan-500/50 text-cyan-100 focus:border-cyan-400"
                      />
                      <p className="text-xs text-purple-400/60 mt-1">
                        No models reported by {settings.model_provider === 'lmstudio' ? 'LM Studio' : 'Ollama'} — is it running?
                        Leave this as <code>auto</code> to use whichever model it has loaded.
                      </p>
                    </>
                  )}
                </div>
                <div>
                  <Label htmlFor="lmstudio-url" className="text-purple-300">LM Studio Base URL</Label>
                  <Input
                    id="lmstudio-url"
                    value={settings.lmstudio_base_url}
                    onChange={(e) => setSettings({ ...settings, lmstudio_base_url: e.target.value })}
                    className="bg-black/40 border-cyan-500/50 text-cyan-100 focus:border-cyan-400"
                  />
                </div>
                <div>
                  <Label htmlFor="lmstudio-api-key" className="text-purple-300">LM Studio API Token</Label>
                  <Input
                    id="lmstudio-api-key"
                    type="password"
                    value={settings.lmstudio_api_key}
                    onChange={(e) => setSettings({ ...settings, lmstudio_api_key: e.target.value })}
                    placeholder="Only if LM Studio requires an API token"
                    className="bg-black/40 border-cyan-500/50 text-cyan-100 focus:border-cyan-400"
                  />
                </div>
                <div>
                  <Label htmlFor="base-url" className="text-purple-300">Ollama Base URL</Label>
                  <Input
                    id="base-url"
                    value={settings.ollama_base_url}
                    onChange={(e) => setSettings({ ...settings, ollama_base_url: e.target.value })}
                    className="bg-black/40 border-cyan-500/50 text-cyan-100 focus:border-cyan-400"
                  />
                </div>
                <div>
                  <Label htmlFor="bsc-license-key" className="text-purple-300">BSC License Key</Label>
                  <Input
                    id="bsc-license-key"
                    type="password"
                    value={settings.bsc_license_key}
                    onChange={(e) => setSettings({ ...settings, bsc_license_key: e.target.value })}
                    placeholder="bsc_… from bloodsweatcode.org → Subscription"
                    className="bg-black/40 border-cyan-500/50 text-cyan-100 focus:border-cyan-400"
                  />
                  <p className="text-xs text-purple-400/60 mt-1">
                    {licenseStatus?.valid ? (
                      <span className="text-emerald-400">Linked — {licenseStatus.tier} tier</span>
                    ) : licenseStatus?.linked ? (
                      <span className="text-red-400">Key rejected{licenseStatus.error ? `: ${licenseStatus.error}` : ''}</span>
                    ) : (
                      <>Unlocks NEO//OPS remote nodes. Get a key at{' '}
                        <a href="https://bloodsweatcode.org/settings/subscription" target="_blank" rel="noreferrer" className="text-cyan-400 underline">bloodsweatcode.org</a>.
                      </>
                    )}
                  </p>
                </div>
                <Button onClick={saveSettings} className="w-full bg-gradient-to-r from-purple-600 to-burgundy-600 hover:from-purple-500 hover:to-burgundy-500">Save</Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Workflow className="h-3.5 w-3.5 text-burgundy-300 shrink-0" />
          <Select value={workflowId} onValueChange={selectWorkflow}>
            <SelectTrigger className="h-8 flex-1 bg-black/40 border-burgundy-500/50 text-cyan-100 text-xs font-mono">
              <SelectValue placeholder="Casper mode" />
            </SelectTrigger>
            <SelectContent className="bg-gray-950 border-burgundy-500/50 text-cyan-100 font-mono">
              {WORKFLOWS.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  <span className="font-semibold">{w.label}</span>
                  <span className="text-purple-400/70"> — {w.description}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-sm font-mono pt-8 px-2 space-y-2">
            <p className="text-burgundy-300">{workflow.label} workflow</p>
            <p className="text-purple-400/70">{workflow.emptyHint}</p>
            {!contextPath && workflow.contextMode !== 'none' && (
              <p className="text-xs text-cyan-400/60">Tip: open a file so the model can see your code.</p>
            )}
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[90%] rounded-lg p-3 font-mono text-sm ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-cyan-600 to-purple-600 text-white border border-cyan-400/30'
                    : 'bg-black/80 text-cyan-100 border border-burgundy-500/50'
                }`}
              >
                {message.reasoning && (
                  <details className="mb-2 text-xs text-burgundy-300/80">
                    <summary className="cursor-pointer select-none">thinking…</summary>
                    <p className="whitespace-pre-wrap mt-1 border-l border-burgundy-500/50 pl-2 text-purple-300/70">{message.reasoning}</p>
                  </details>
                )}
                {message.role === 'assistant' ? (
                  <>
                    {splitCodeBlocks(message.content).map((segment, i) =>
                      segment.type === 'code' ? (
                        <CodeBlock
                          key={i}
                          code={segment.content}
                          language={segment.language}
                          canApply={!!selectedFileId}
                          onApply={onApplyCode ? () => onApplyCode(segment.content) : undefined}
                        />
                      ) : (
                        <p key={i} className="text-sm whitespace-pre-wrap">{segment.content}</p>
                      )
                    )}
                    {(() => {
                      const batch = extractPathedBlocks(message.content);
                      if (batch.length < 1 || !onApplyMany) return null;
                      return (
                        <Button
                          size="sm"
                          onClick={() => onApplyMany(batch)}
                          className="mt-2 h-7 text-[11px] bg-burgundy-600/40 hover:bg-burgundy-500/50 border border-burgundy-400/50 text-burgundy-100"
                        >
                          Apply All ({batch.length} file{batch.length === 1 ? '' : 's'})
                        </Button>
                      );
                    })()}
                  </>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}
                {message.id === STREAMING_ID && !message.content && !message.reasoning && (
                  <span className="animate-pulse text-purple-400">▋</span>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-cyan-500/30 space-y-2">
        <div className="flex flex-wrap gap-1">
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded border border-burgundy-500/50 text-burgundy-300 bg-burgundy-600/15"
            title={workflow.description}
          >
            casper: {workflow.label}
          </span>
          {workflow.contextMode === 'project' && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-purple-500/40 text-purple-300 bg-purple-500/10">
              ctx: project tree
            </span>
          )}
          {contextPath && (
            <button
              onClick={() => setIncludeFile(!includeFile)}
              className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                includeFile
                  ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10'
                  : 'border-gray-600 text-gray-500 line-through'
              }`}
              title="Toggle sending the open file as context"
            >
              ctx: {contextPath}
            </button>
          )}
        </div>
        {micError && (
          <p className="text-[10px] font-mono text-red-400/80">{micError}</p>
        )}
        <div className="flex gap-2">
          <Input
            placeholder={isListening ? 'Listening…' : workflow.inputPlaceholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            disabled={isLoading}
            className="bg-black/40 border-cyan-500/50 text-cyan-100 placeholder:text-purple-400/40 focus:border-cyan-400"
          />
          <Button
            onClick={toggleMic}
            disabled={!speechSupported || isLoading}
            title={
              !speechSupported
                ? 'Speech recognition not supported in this browser — try Chrome or Edge'
                : isListening ? 'Stop dictation' : 'Dictate a message'
            }
            className={isListening
              ? 'bg-red-600 hover:bg-red-500 animate-pulse'
              : 'bg-black/40 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20'}
          >
            <Mic className="h-4 w-4" />
          </Button>
          {isLoading ? (
            <Button
              onClick={stopStreaming}
              className="bg-red-600/80 hover:bg-red-500"
              title="Stop generating"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="bg-gradient-to-r from-purple-600 to-burgundy-600 hover:from-purple-500 hover:to-burgundy-500"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
