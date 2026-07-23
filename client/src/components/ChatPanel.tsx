import * as React from 'react';
import { Send, Settings, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';

interface Message {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatPanelProps {
  selectedFileId: number | null;
}

export default function ChatPanel({ selectedFileId }: ChatPanelProps) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [settings, setSettings] = React.useState({
    ollama_base_url: 'http://localhost:11434',
    model_name: 'codellama'
  });
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    loadMessages();
    loadSettings();
  }, []);

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
      setSettings(data);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async function saveSettings() {
    try {
      await fetch('/api/settings/ollama_base_url', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: settings.ollama_base_url })
      });
      await fetch('/api/settings/model_name', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: settings.model_name })
      });
      setIsSettingsOpen(false);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  async function sendMessage() {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    setIsLoading(true);

    try {
      // Save user message
      const userMsgResponse = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content: userMessage })
      });
      const savedUserMsg = await userMsgResponse.json();
      setMessages(prev => [...prev, savedUserMsg]);

      // Get completion
      const chatMessages = [...messages, { role: 'user', content: userMessage }].map(m => ({
        role: m.role,
        content: m.content
      }));

      const completionResponse = await fetch('/api/chat/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: chatMessages,
          model: settings.model_name
        })
      });
      
      const completion = await completionResponse.json();
      const assistantContent = completion.message?.content || 'No response';

      // Save assistant message
      const assistantMsgResponse = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'assistant', content: assistantContent })
      });
      const savedAssistantMsg = await assistantMsgResponse.json();
      setMessages(prev => [...prev, savedAssistantMsg]);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function clearChat() {
    try {
      await fetch('/api/chat/messages', { method: 'DELETE' });
      setMessages([]);
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold">AI Assistant</h2>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={clearChat}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="base-url">Ollama Base URL</Label>
                  <Input
                    id="base-url"
                    value={settings.ollama_base_url}
                    onChange={(e) => setSettings({ ...settings, ollama_base_url: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="model">Model Name</Label>
                  <Input
                    id="model"
                    value={settings.model_name}
                    onChange={(e) => setSettings({ ...settings, model_name: e.target.value })}
                  />
                </div>
                <Button onClick={saveSettings} className="w-full">Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground pt-8">
            Start a conversation with your AI assistant
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            placeholder="Ask about code or request changes..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            disabled={isLoading}
          />
          <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
