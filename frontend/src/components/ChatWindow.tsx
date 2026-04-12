import React, { useState, useRef, useEffect } from 'react';
import { agentsApi } from '../lib/agentsApi';
import { X, Send, Cpu, Wrench } from 'lucide-react';
import { Button } from './ui/button';

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  isTool?: boolean;
  toolName?: string;
}

interface ChatWindowProps {
  sessionId: string;
  onClose: (id: string) => void;
  defaultPosition?: { x: number, y: number }; // Kept for backwards compatibility if needed
}

export function ChatWindow({ sessionId, onClose }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isRunning) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsRunning(true);

    try {
      const response = await agentsApi.runSession(sessionId, userMessage.content);

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let currentAgentMsgId = 'agent-' + Date.now();

      // Initialize an empty agent message
      setMessages(prev => [...prev, { id: currentAgentMsgId, role: 'agent', content: '' }]);

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue;

            try {
              const event = JSON.parse(dataStr);

              if (event.type === 'agent.message') {
                if (event.content?.[0]?.type === 'text') {
                  setMessages(prev => prev.map(m =>
                    m.id === currentAgentMsgId ? { ...m, content: event.content[0].text } : m
                  ));
                }
              } else if (event.type === 'agent.custom_tool_use' || event.type === 'agent.tool_use') {
                 // Add a tool marker
                 setMessages(prev => [...prev, {
                   id: 'tool-' + Date.now(),
                   role: 'agent',
                   content: 'Used tool: ' + (event.name || event.tool_name || 'unknown'),
                   isTool: true,
                   toolName: event.name || event.tool_name
                 }]);

                 // Start a new agent text message after the tool
                 currentAgentMsgId = 'agent-' + Date.now();
                 setMessages(prev => [...prev, { id: currentAgentMsgId, role: 'agent', content: '' }]);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'agent', content: 'Error: Connection failed.' }]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-[300px] border-r border-gray-200 h-full bg-white relative overflow-hidden">
      {/* Header */}
      <div className="bg-white p-3 border-b border-gray-200 flex justify-between items-center select-none flex-shrink-0">
        <div className="flex items-center gap-2">
          <Cpu size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-700">Session {sessionId.substring(0,6)}</span>
        </div>
        <button onClick={() => onClose(sessionId)} className="text-gray-500 hover:text-red-500 cursor-pointer">
          <X size={16} />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 flex flex-col">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-10 text-sm">Send a message to start...</div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}>
              {msg.isTool ? (
                <div className="flex items-center gap-2 text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full border border-purple-200">
                  <Wrench size={12} />
                  <span>{msg.content}</span>
                </div>
              ) : msg.content ? (
                <div className={`px-3 py-2 rounded-lg text-sm shadow-sm ${msg.role === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'}`}>
                  {msg.content}
                </div>
              ) : msg.role === 'agent' && (
                <div className="px-3 py-2 text-gray-400 text-xs italic">Typing...</div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white border-t border-gray-200 flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-100 border-none rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isRunning}
          />
          <Button type="submit" disabled={isRunning || !input.trim()} size="icon" className="bg-blue-500 hover:bg-blue-600">
            <Send size={16} />
          </Button>
        </form>
      </div>
    </div>
  );
}
