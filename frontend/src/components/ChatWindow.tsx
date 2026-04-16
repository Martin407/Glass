import React, { useState, useRef, useEffect, useCallback } from 'react';
import { agentsApi } from '../lib/agentsApi';
import {
  X,
  Send,
  Cpu,
  Wrench,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  StopCircle,
  Brain,
  RefreshCw,
  FileText,
  Paperclip,
  GitBranch,
  FolderOpen,
  Edit2,
  Trash2,
  Plus,
} from 'lucide-react';
import { Button } from './ui/button';
import type { ModelUsage, RawEvent, SessionResource, UiMessage } from './chat/types';
import { extractText, formatErrorType } from './chat/utils';
import { CustomToolUseCard, ExpandableToolCard, ToolUseCard } from './chat/ToolCards';

interface ChatWindowProps {
  sessionId: string;
  sessionTitle?: string | null;
  onClose: (id: string) => void;
  defaultPosition?: { x: number; y: number };
}

export function ChatWindow({ sessionId, sessionTitle: sessionTitleProp, onClose }: ChatWindowProps) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());
  const [totalUsage, setTotalUsage] = useState<ModelUsage & { requests?: number }>({ requests: 0 });
  const [showUsage, setShowUsage] = useState(false);

  // ── Title editing state ──────────────────────────────────────────────────────
  const [sessionTitle, setSessionTitle] = useState<string | null>(sessionTitleProp ?? null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [titleBusy, setTitleBusy] = useState(false);

  // ── Resources state ──────────────────────────────────────────────────────────
  const [showResources, setShowResources] = useState(false);
  const [resources, setResources] = useState<SessionResource[]>([]);
  const [resourcesBusy, setResourcesBusy] = useState(false);
  const [addResourceType, setAddResourceType] = useState<'file' | 'github'>('file');
  const [addResourceDialogOpen, setAddResourceDialogOpen] = useState(false);
  const [newResourceFileId, setNewResourceFileId] = useState('');
  const [newResourceMountPath, setNewResourceMountPath] = useState('');
  const [newResourceGithubUrl, setNewResourceGithubUrl] = useState('');
  const [newResourceCheckoutType, setNewResourceCheckoutType] = useState<'branch' | 'commit'>('branch');
  const [newResourceCheckoutValue, setNewResourceCheckoutValue] = useState('');
  const [addResourceBusy, setAddResourceBusy] = useState(false);
  const [addResourceError, setAddResourceError] = useState<string | null>(null);
  const [resourceActionBusy, setResourceActionBusy] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => { abortControllerRef.current?.abort(); };
  }, []);

  // ── On mount: fetch session details and resources ────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const session = await agentsApi.getSession(sessionId) as { title?: string; status?: string };
        if (session?.title) {
          setSessionTitle(session.title);
        }
      } catch (err) {
        console.error('Failed to fetch session details', err);
      }
    })();

    loadResources();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Focus title input when editing starts
  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  // ── Resources handlers ───────────────────────────────────────────────────────

  const loadResources = useCallback(async () => {
    setResourcesBusy(true);
    try {
      const result = await agentsApi.listSessionResources(sessionId) as { resources?: SessionResource[] } | SessionResource[];
      const list = Array.isArray(result) ? result : (result?.resources ?? []);
      setResources(list);
    } catch (err) {
      console.error('Failed to load resources', err);
    } finally {
      setResourcesBusy(false);
    }
  }, [sessionId]);

  const handleAddResource = async () => {
    setAddResourceError(null);
    setAddResourceBusy(true);
    try {
      if (addResourceType === 'file') {
        if (!newResourceFileId.trim()) {
          setAddResourceError('File ID is required.');
          return;
        }
        const data: Record<string, unknown> = { type: 'file', file_id: newResourceFileId.trim() };
        if (newResourceMountPath.trim()) data.mount_path = newResourceMountPath.trim();
        await agentsApi.addSessionResource(sessionId, data);
      } else {
        if (!newResourceGithubUrl.trim()) {
          setAddResourceError('GitHub URL is required.');
          return;
        }
        const data: Record<string, unknown> = { type: 'github_repository', url: newResourceGithubUrl.trim() };
        if (newResourceCheckoutValue.trim()) {
          data.checkout = { type: newResourceCheckoutType, value: newResourceCheckoutValue.trim() };
        }
        await agentsApi.addSessionResource(sessionId, data);
      }
      setNewResourceFileId('');
      setNewResourceMountPath('');
      setNewResourceGithubUrl('');
      setNewResourceCheckoutType('branch');
      setNewResourceCheckoutValue('');
      setAddResourceDialogOpen(false);
      await loadResources();
    } catch (err) {
      setAddResourceError(err instanceof Error ? err.message : 'Failed to add resource.');
    } finally {
      setAddResourceBusy(false);
    }
  };

  const handleDeleteResource = async (resourceId: string) => {
    setResourceActionBusy(resourceId);
    try {
      await agentsApi.deleteSessionResource(sessionId, resourceId);
      setResources(prev => prev.filter(r => r.id !== resourceId));
    } catch (err) {
      console.error('Failed to delete resource', err);
    } finally {
      setResourceActionBusy(null);
    }
  };

  // ── Title handlers ───────────────────────────────────────────────────────────

  const startEditingTitle = () => {
    setTitleInput(sessionTitle ?? '');
    setEditingTitle(true);
  };

  const cancelEditingTitle = () => {
    setEditingTitle(false);
    setTitleInput('');
  };

  const handleUpdateTitle = async () => {
    if (titleBusy) return;
    setTitleBusy(true);
    try {
      await agentsApi.updateSession(sessionId, { title: titleInput.trim() || null });
      setSessionTitle(titleInput.trim() || null);
      setEditingTitle(false);
    } catch (err) {
      console.error('Failed to update title', err);
    } finally {
      setTitleBusy(false);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      void handleUpdateTitle();
    } else if (e.key === 'Escape') {
      cancelEditingTitle();
    }
  };

  // ── Message helpers ──────────────────────────────────────────────────────────

  const addMessage = useCallback((msg: Omit<UiMessage, 'id'>) => {
    const id = crypto.randomUUID();
    setMessages(prev => [...prev, { id, ...msg }]);
    return id;
  }, []);

  const updateMessage = useCallback((id: string, patch: Partial<UiMessage>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  }, []);

  const processEvent = useCallback((event: RawEvent, currentAgentMsgRef: React.MutableRefObject<string | null>, lastAgentEventIdRef: React.MutableRefObject<string | null>) => {
    const eventId = typeof event.id === 'string' ? event.id : undefined;

    switch (event.type) {
      case 'agent.message': {
        if (eventId && eventId !== lastAgentEventIdRef.current) {
          lastAgentEventIdRef.current = eventId;
          currentAgentMsgRef.current = null;
        }
        const text = extractText(event.content);
        if (!text) break;
        if (!currentAgentMsgRef.current) {
          const id = addMessage({ kind: 'agent', content: text, eventId });
          currentAgentMsgRef.current = id;
        } else {
          updateMessage(currentAgentMsgRef.current, { content: text });
        }
        break;
      }

      case 'agent.thinking': {
        currentAgentMsgRef.current = null;
        addMessage({ kind: 'thinking', content: 'Thinking…' });
        break;
      }

      case 'agent.tool_use': {
        currentAgentMsgRef.current = null;
        const needsConfirm = event.evaluated_permission === 'ask';
        if (needsConfirm && eventId) {
          setPendingActions(prev => new Set(prev).add(eventId));
          addMessage({
            kind: 'requires_action',
            toolName: event.name,
            toolInput: event.input,
            toolUseId: eventId,
            eventId,
            permission: event.evaluated_permission,
          });
        } else {
          addMessage({
            kind: 'tool_use',
            toolName: event.name,
            toolInput: event.input,
            eventId,
            permission: event.evaluated_permission,
          });
        }
        break;
      }

      case 'agent.tool_result': {
        const text = extractText(event.content as Array<{ type?: string; text?: string }>);
        addMessage({ kind: 'tool_result', toolUseId: event.tool_use_id, content: text, isError: event.is_error });
        break;
      }

      case 'agent.mcp_tool_use': {
        currentAgentMsgRef.current = null;
        const needsConfirm = event.evaluated_permission === 'ask';
        if (needsConfirm && eventId) {
          setPendingActions(prev => new Set(prev).add(eventId));
          addMessage({
            kind: 'requires_action',
            toolName: event.name,
            mcpServer: event.mcp_server_name,
            toolInput: event.input,
            toolUseId: eventId,
            eventId,
            permission: event.evaluated_permission,
          });
        } else {
          addMessage({
            kind: 'mcp_tool_use',
            toolName: event.name,
            mcpServer: event.mcp_server_name,
            toolInput: event.input,
            eventId,
            permission: event.evaluated_permission,
          });
        }
        break;
      }

      case 'agent.mcp_tool_result': {
        const text = extractText(event.content as Array<{ type?: string; text?: string }>);
        addMessage({ kind: 'mcp_tool_result', content: text, isError: event.is_error, eventId: event.mcp_tool_use_id });
        break;
      }

      case 'agent.custom_tool_use': {
        currentAgentMsgRef.current = null;
        const id = eventId ?? crypto.randomUUID();
        if (eventId) setPendingActions(prev => new Set(prev).add(eventId));
        addMessage({
          kind: 'custom_tool_use',
          toolName: event.name,
          toolInput: event.input,
          customToolUseId: id,
          eventId: id,
        });
        break;
      }

      case 'agent.thread_context_compacted': {
        addMessage({ kind: 'compacted', content: 'Context compacted to save space.' });
        break;
      }

      case 'session.status_running': {
        setIsRunning(true);
        break;
      }
      case 'session.status_idle': {
        currentAgentMsgRef.current = null;
        lastAgentEventIdRef.current = null;
        setIsRunning(false);
        if (event.stop_reason?.type === 'retries_exhausted') {
          addMessage({ kind: 'error', content: 'Retries exhausted. The session stopped.' });
        }
        break;
      }
      case 'session.status_rescheduled': {
        addMessage({ kind: 'status', content: 'Session rescheduled, reconnecting…' });
        break;
      }
      case 'session.status_terminated':
      case 'session.deleted': {
        currentAgentMsgRef.current = null;
        setIsRunning(false);
        addMessage({ kind: 'status', content: 'Session terminated.' });
        break;
      }

      case 'session.error': {
        const err = event.error;
        if (err) {
          const retrying = err.retry_status.type === 'retrying';
          addMessage({ kind: 'error', content: err.message, errorPayload: err });
          if (retrying) {
            addMessage({ kind: 'status', content: 'Retrying…' });
          } else {
            setIsRunning(false);
          }
        }
        break;
      }

      case 'span.model_request_end': {
        const u = event.model_usage;
        if (u) {
          setTotalUsage(prev => ({
            input_tokens: (prev.input_tokens ?? 0) + (u.input_tokens ?? 0),
            output_tokens: (prev.output_tokens ?? 0) + (u.output_tokens ?? 0),
            cache_creation_input_tokens: (prev.cache_creation_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
            cache_read_input_tokens: (prev.cache_read_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
            requests: (prev.requests ?? 0) + 1,
          }));
        }
        break;
      }

      default:
        break;
    }
  }, [addMessage, updateMessage]);

  const sendMessage = async (text: string) => {
    if (isRunning) return;

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    addMessage({ kind: 'user', content: text });
    setInput('');
    setIsRunning(true);
    setPendingActions(new Set());

    const currentAgentMsgRef = { current: null as string | null };
    const lastAgentEventIdRef = { current: null as string | null };

    try {
      const response = await agentsApi.runSession(sessionId, text, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6);
          if (dataStr === '[DONE]') continue;
          try {
            const event = JSON.parse(dataStr) as RawEvent;
            processEvent(event, currentAgentMsgRef, lastAgentEventIdRef);
            if (
              event.type === 'session.status_idle' ||
              event.type === 'session.status_terminated' ||
              event.type === 'session.deleted'
            ) {
              reader.cancel().catch(() => {});
              return;
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'name' in err && (err as { name: unknown }).name === 'AbortError') return;
      console.error(err);
      addMessage({ kind: 'error', content: err instanceof Error ? err.message : 'Connection failed.' });
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isRunning) return;
    await sendMessage(input);
  };

  const handleInterrupt = async () => {
    try {
      await agentsApi.interruptSession(sessionId);
      addMessage({ kind: 'status', content: 'Interrupted.' });
    } catch (err) {
      console.error('interrupt failed', err);
    }
  };

  const handleToolResolved = (eventId: string) => {
    setPendingActions(prev => {
      const next = new Set(prev);
      next.delete(eventId);
      return next;
    });
    setIsRunning(true);
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const currentAgentMsgRef = { current: null as string | null };
    const lastAgentEventIdRef = { current: null as string | null };
    const ctrl = abortControllerRef.current;

    (async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/events/stream`, {
          signal: ctrl.signal,
        });
        if (!response.ok || !response.body) return;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue;
            try {
              const event = JSON.parse(dataStr) as RawEvent;
              processEvent(event, currentAgentMsgRef, lastAgentEventIdRef);
              if (event.type === 'session.status_idle' || event.type === 'session.status_terminated') {
                reader.cancel().catch(() => {});
                return;
              }
            } catch { /* ignore */ }
          }
        }
      } catch (err: unknown) {
        if (typeof err === 'object' && err !== null && 'name' in err && (err as { name: unknown }).name === 'AbortError') return;
      } finally {
        setIsRunning(false);
      }
    })();
  };

  const renderMessage = (msg: UiMessage) => {
    switch (msg.kind) {
      case 'user':
        return (
          <div key={msg.id} className="flex flex-col max-w-[85%] self-end items-end">
            <div className="px-3 py-2 rounded-lg rounded-br-none text-sm shadow-sm bg-blue-500 text-white">
              {msg.content}
            </div>
          </div>
        );

      case 'agent':
        return (
          <div key={msg.id} className="flex flex-col max-w-[85%] self-start items-start">
            <div className="px-3 py-2 rounded-lg rounded-bl-none text-sm shadow-sm bg-white border border-gray-200 text-gray-800 whitespace-pre-wrap">
              {msg.content || <span className="italic text-gray-400">Typing…</span>}
            </div>
          </div>
        );

      case 'thinking':
        return (
          <div key={msg.id} className="self-start">
            <div className="flex items-center gap-1.5 text-xs text-violet-500 italic px-1">
              <Brain size={12} className="animate-pulse" />
              {msg.content}
            </div>
          </div>
        );

      case 'tool_use':
        return (
          <div key={msg.id} className="self-start">
            <ExpandableToolCard
              msg={msg}
              colorClass="bg-blue-50 border-blue-200 text-blue-700"
              icon={<Wrench size={12} />}
              label={msg.toolName ?? 'Tool'}
            />
          </div>
        );

      case 'tool_result':
        return (
          <div key={msg.id} className="self-start">
            <ExpandableToolCard
              msg={msg}
              colorClass={msg.isError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}
              icon={msg.isError ? <XCircle size={12} /> : <CheckCircle size={12} />}
              label={msg.isError ? 'Tool error' : 'Tool result'}
            />
          </div>
        );

      case 'mcp_tool_use':
        return (
          <div key={msg.id} className="self-start">
            <ExpandableToolCard
              msg={msg}
              colorClass="bg-purple-50 border-purple-200 text-purple-700"
              icon={<Wrench size={12} />}
              label={`${msg.mcpServer ? msg.mcpServer + ' › ' : ''}${msg.toolName ?? 'MCP tool'}`}
            />
          </div>
        );

      case 'mcp_tool_result':
        return (
          <div key={msg.id} className="self-start">
            <ExpandableToolCard
              msg={msg}
              colorClass={msg.isError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-purple-50 border-purple-200 text-purple-700'}
              icon={msg.isError ? <XCircle size={12} /> : <CheckCircle size={12} />}
              label={msg.isError ? 'MCP error' : 'MCP result'}
            />
          </div>
        );

      case 'requires_action':
        return (
          <div key={msg.id} className="self-start">
            <ToolUseCard
              msg={msg}
              sessionId={sessionId}
              onResolved={() => msg.eventId && handleToolResolved(msg.eventId)}
            />
          </div>
        );

      case 'custom_tool_use':
        return (
          <div key={msg.id} className="self-start">
            <CustomToolUseCard
              msg={msg}
              sessionId={sessionId}
              onResolved={() => msg.eventId && handleToolResolved(msg.eventId)}
            />
          </div>
        );

      case 'compacted':
        return (
          <div key={msg.id} className="self-center">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 italic px-2 py-1 rounded-full bg-gray-100 border border-gray-200">
              <RefreshCw size={10} />
              {msg.content}
            </div>
          </div>
        );

      case 'status':
        return (
          <div key={msg.id} className="self-center">
            <div className="text-xs text-gray-400 italic px-1">{msg.content}</div>
          </div>
        );

      case 'error': {
        const err = msg.errorPayload;
        return (
          <div key={msg.id} className="self-start max-w-[90%]">
            <div className="flex items-start gap-2 text-xs bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg">
              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
              <div>
                {err && <span className="font-medium">{formatErrorType(err.type)}: </span>}
                {msg.content}
                {err?.retry_status.type === 'retrying' && (
                  <span className="ml-1 opacity-60">(retrying…)</span>
                )}
              </div>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const hasPendingActions = pendingActions.size > 0;

  return (
    <div className="flex-1 flex flex-col min-w-[340px] border-r border-gray-200 h-full bg-white relative overflow-hidden">
      {/* Header */}
      <div className="bg-white px-3 py-2 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Cpu size={15} className="text-blue-500 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            {editingTitle ? (
              <div className="flex items-center gap-1">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={titleInput}
                  onChange={e => setTitleInput(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  className="flex-1 min-w-0 text-sm bg-gray-100 border border-gray-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Session title…"
                  disabled={titleBusy}
                />
                <button
                  type="button"
                  onClick={() => void handleUpdateTitle()}
                  disabled={titleBusy}
                  className="flex items-center gap-0.5 text-xs text-white bg-blue-500 hover:bg-blue-600 px-1.5 py-0.5 rounded disabled:opacity-50"
                  title="Save title"
                >
                  {titleBusy ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                </button>
                <button
                  type="button"
                  onClick={cancelEditingTitle}
                  disabled={titleBusy}
                  className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700 px-1 py-0.5 rounded hover:bg-gray-100 disabled:opacity-50"
                  title="Cancel"
                >
                  <X size={10} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 group min-w-0">
                {sessionTitle ? (
                  <div className="font-semibold text-sm text-gray-800 truncate">{sessionTitle}</div>
                ) : (
                  <div className="font-mono text-xs text-gray-600">
                    {sessionId.substring(0, 8)}…
                  </div>
                )}
                <button
                  type="button"
                  onClick={startEditingTitle}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-gray-400 hover:text-gray-600 p-0.5 rounded transition-opacity"
                  title="Edit title"
                >
                  <Edit2 size={11} />
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowResources(v => !v)}
            className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border transition-colors ${
              showResources
                ? 'text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100'
                : 'text-gray-400 border-gray-200 hover:text-gray-600 hover:bg-gray-50'
            }`}
            title="Session resources"
          >
            <Paperclip size={10} />
            {resources.length > 0 && <span>{resources.length}</span>}
          </button>
          {(totalUsage.requests ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => setShowUsage(v => !v)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded border border-gray-200 hover:bg-gray-50"
              title="Token usage"
            >
              <FileText size={10} />
              {((totalUsage.input_tokens ?? 0) + (totalUsage.output_tokens ?? 0)).toLocaleString()} tok
            </button>
          )}
          {isRunning && (
            <button
              type="button"
              onClick={() => void handleInterrupt()}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded border border-red-200 hover:bg-red-50"
              title="Interrupt session"
            >
              <StopCircle size={10} />
              Stop
            </button>
          )}
          <button
            onClick={() => onClose(sessionId)}
            className="text-gray-400 hover:text-red-500 cursor-pointer p-0.5"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Token usage panel */}
      {showUsage && (
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-600 grid grid-cols-2 gap-x-4 gap-y-0.5">
          <div>Input tokens: <span className="font-medium">{(totalUsage.input_tokens ?? 0).toLocaleString()}</span></div>
          <div>Output tokens: <span className="font-medium">{(totalUsage.output_tokens ?? 0).toLocaleString()}</span></div>
          {(totalUsage.cache_creation_input_tokens ?? 0) > 0 && (
            <div>Cache write: <span className="font-medium">{totalUsage.cache_creation_input_tokens!.toLocaleString()}</span></div>
          )}
          {(totalUsage.cache_read_input_tokens ?? 0) > 0 && (
            <div>Cache read: <span className="font-medium">{totalUsage.cache_read_input_tokens!.toLocaleString()}</span></div>
          )}
          <div>Requests: <span className="font-medium">{totalUsage.requests ?? 0}</span></div>
        </div>
      )}

      {/* Resources panel */}
      {showResources && (
        <div className="border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
              <Paperclip size={11} />
              Resources
              {resourcesBusy && <Loader2 size={10} className="animate-spin text-gray-400" />}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setAddResourceDialogOpen(v => !v);
                  setAddResourceError(null);
                }}
                className="flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded hover:bg-blue-50"
                title="Add resource"
              >
                <Plus size={11} />
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowResources(false)}
                className="text-gray-400 hover:text-gray-600 p-0.5 rounded hover:bg-gray-100"
                title="Close resources panel"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {addResourceDialogOpen && (
            <div className="px-3 py-2 border-b border-gray-200 bg-white text-xs space-y-2">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setAddResourceType('file')}
                  className={`flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium transition-colors ${
                    addResourceType === 'file'
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <FolderOpen size={10} />
                  File
                </button>
                <button
                  type="button"
                  onClick={() => setAddResourceType('github')}
                  className={`flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium transition-colors ${
                    addResourceType === 'github'
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <GitBranch size={10} />
                  GitHub
                </button>
              </div>

              {addResourceType === 'file' ? (
                <div className="space-y-1.5">
                  <div>
                    <label className="block text-gray-500 mb-0.5">File ID <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={newResourceFileId}
                      onChange={e => setNewResourceFileId(e.target.value)}
                      placeholder="file_abc123…"
                      className="w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-0.5">Mount path <span className="text-gray-400">(optional)</span></label>
                    <input
                      type="text"
                      value={newResourceMountPath}
                      onChange={e => setNewResourceMountPath(e.target.value)}
                      placeholder="/workspace/file.txt"
                      className="w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div>
                    <label className="block text-gray-500 mb-0.5">GitHub URL <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={newResourceGithubUrl}
                      onChange={e => setNewResourceGithubUrl(e.target.value)}
                      placeholder="https://github.com/owner/repo"
                      className="w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <div className="flex-shrink-0">
                      <label className="block text-gray-500 mb-0.5">Checkout type</label>
                      <select
                        value={newResourceCheckoutType}
                        onChange={e => setNewResourceCheckoutType(e.target.value as 'branch' | 'commit')}
                        className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        <option value="branch">Branch</option>
                        <option value="commit">Commit</option>
                      </select>
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="block text-gray-500 mb-0.5">Value <span className="text-gray-400">(optional)</span></label>
                      <input
                        type="text"
                        value={newResourceCheckoutValue}
                        onChange={e => setNewResourceCheckoutValue(e.target.value)}
                        placeholder={newResourceCheckoutType === 'branch' ? 'main' : 'abc1234…'}
                        className="w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {addResourceError && (
                <div className="flex items-center gap-1 text-red-600 text-xs">
                  <AlertTriangle size={10} />
                  {addResourceError}
                </div>
              )}

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => void handleAddResource()}
                  disabled={addResourceBusy}
                  className="flex items-center gap-1 rounded bg-blue-500 text-white px-2 py-1 text-xs font-medium hover:bg-blue-600 disabled:opacity-50"
                >
                  {addResourceBusy ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddResourceDialogOpen(false);
                    setAddResourceError(null);
                  }}
                  disabled={addResourceBusy}
                  className="flex items-center gap-1 rounded border border-gray-200 text-gray-600 px-2 py-1 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="max-h-40 overflow-y-auto">
            {resources.length === 0 ? (
              <div className="px-3 py-3 text-xs text-gray-400 italic text-center">
                No resources attached.
              </div>
            ) : (
              resources.map(resource => (
                <div
                  key={resource.id}
                  className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 last:border-0 hover:bg-white group"
                >
                  {resource.type === 'file' ? (
                    <FolderOpen size={11} className="flex-shrink-0 text-blue-400" />
                  ) : (
                    <GitBranch size={11} className="flex-shrink-0 text-green-500" />
                  )}
                  <div className="flex-1 min-w-0 text-xs">
                    {resource.type === 'file' ? (
                      <>
                        <span className="text-gray-700 font-mono truncate block">{resource.file_id}</span>
                        {resource.mount_path && (
                          <span className="text-gray-400 truncate block">{resource.mount_path}</span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="text-gray-700 truncate block">{resource.url}</span>
                        {resource.checkout && (
                          <span className="text-gray-400 truncate block">
                            {resource.checkout.type}: {resource.checkout.value}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDeleteResource(resource.id)}
                    disabled={resourceActionBusy === resource.id}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-red-400 hover:text-red-600 p-0.5 rounded disabled:opacity-30 transition-opacity"
                    title="Delete resource"
                  >
                    {resourceActionBusy === resource.id
                      ? <Loader2 size={11} className="animate-spin" />
                      : <Trash2 size={11} />
                    }
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 flex flex-col">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-10 text-sm">Send a message to start…</div>
        ) : (
          messages.map(msg => renderMessage(msg))
        )}
        {isRunning && !hasPendingActions && (
          <div className="self-start flex items-center gap-1.5 text-xs text-gray-400">
            <Loader2 size={12} className="animate-spin" />
            Running…
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-white border-t border-gray-200 flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={hasPendingActions ? 'Respond to tool requests above…' : 'Type a message…'}
            className="flex-1 bg-gray-100 border-none rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isRunning && !hasPendingActions}
          />
          <Button
            type="submit"
            disabled={(isRunning && !hasPendingActions) || !input.trim()}
            size="icon"
            className="bg-blue-500 hover:bg-blue-600"
          >
            <Send size={16} />
          </Button>
        </form>
      </div>
    </div>
  );
}
