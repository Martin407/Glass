import { useState } from 'react';
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  Wrench,
  XCircle,
  Zap,
} from 'lucide-react';
import { agentsApi } from '../../lib/agentsApi';
import { formatInput } from './utils';
import type { UiMessage } from './types';

// ── ToolUseCard ───────────────────────────────────────────────────────────────

export function ToolUseCard({ msg, sessionId, onResolved }: {
  msg: UiMessage;
  sessionId: string;
  onResolved: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  const handle = async (result: 'allow' | 'deny') => {
    if (!msg.toolUseId) return;
    setBusy(true);
    try {
      await agentsApi.confirmTool(sessionId, msg.toolUseId, result);
      onResolved();
    } catch (err) {
      console.error('tool_confirmation failed', err);
    } finally {
      setBusy(false);
    }
  };

  const permColor =
    msg.permission === 'ask'
      ? 'bg-orange-50 border-orange-200 text-orange-700'
      : msg.permission === 'deny'
      ? 'bg-red-50 border-red-200 text-red-700'
      : 'bg-blue-50 border-blue-200 text-blue-700';

  return (
    <div className={`self-start rounded-lg border text-xs max-w-[90%] overflow-hidden ${permColor}`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <Wrench size={12} />
        <span className="font-medium">{msg.toolName}</span>
        {msg.mcpServer && <span className="opacity-60">({msg.mcpServer})</span>}
        <span className="opacity-60 ml-auto">Waiting for approval</span>
        {msg.toolInput && (
          <button type="button" onClick={() => setExpanded(e => !e)} className="opacity-60 hover:opacity-100">
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        )}
      </div>
      {expanded && msg.toolInput && (
        <pre className="px-3 pb-2 text-xs opacity-70 whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
          {formatInput(msg.toolInput)}
        </pre>
      )}
      <div className="flex gap-1.5 px-3 pb-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handle('allow')}
          className="flex items-center gap-1 rounded-md bg-green-500 text-white px-2 py-1 font-medium hover:bg-green-600 disabled:opacity-50"
        >
          {busy ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
          Allow
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handle('deny')}
          className="flex items-center gap-1 rounded-md bg-red-100 text-red-700 px-2 py-1 font-medium hover:bg-red-200 disabled:opacity-50"
        >
          <XCircle size={10} />
          Deny
        </button>
      </div>
    </div>
  );
}

// ── CustomToolUseCard ─────────────────────────────────────────────────────────

export function CustomToolUseCard({ msg, sessionId, onResolved }: {
  msg: UiMessage;
  sessionId: string;
  onResolved: () => void;
}) {
  const [resultText, setResultText] = useState('');
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleSubmit = async () => {
    if (!msg.customToolUseId) return;
    setBusy(true);
    try {
      await agentsApi.sendCustomToolResult(
        sessionId,
        msg.customToolUseId,
        [{ type: 'text', text: resultText }],
        isError,
      );
      onResolved();
    } catch (err) {
      console.error('custom_tool_result failed', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="self-start rounded-lg border border-indigo-200 bg-indigo-50 text-xs max-w-[90%] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 text-indigo-700">
        <Zap size={12} />
        <span className="font-medium">Custom tool: {msg.toolName}</span>
        {msg.toolInput && (
          <button type="button" onClick={() => setExpanded(e => !e)} className="opacity-60 hover:opacity-100 ml-auto">
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        )}
      </div>
      {expanded && msg.toolInput && (
        <pre className="px-3 pb-2 text-xs opacity-70 whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
          {formatInput(msg.toolInput)}
        </pre>
      )}
      <div className="px-3 pb-2 space-y-1.5">
        <p className="text-indigo-600">Provide a result for this tool:</p>
        <textarea
          value={resultText}
          onChange={e => setResultText(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-indigo-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none"
          placeholder="Tool result…"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1 text-indigo-600 cursor-pointer">
            <input type="checkbox" checked={isError} onChange={e => setIsError(e.target.checked)} className="rounded" />
            Mark as error
          </label>
          <button
            type="button"
            disabled={busy || !resultText.trim()}
            onClick={() => void handleSubmit()}
            className="flex items-center gap-1 rounded-md bg-indigo-500 text-white px-2 py-1 font-medium hover:bg-indigo-600 disabled:opacity-50"
          >
            {busy ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ExpandableToolCard ────────────────────────────────────────────────────────

export function ExpandableToolCard({ msg, colorClass, icon, label }: {
  msg: UiMessage;
  colorClass: string;
  icon: React.ReactNode;
  label: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!msg.content || !!msg.toolInput;
  return (
    <div className={`self-start rounded-lg border text-xs max-w-[90%] overflow-hidden ${colorClass}`}>
      <button
        type="button"
        onClick={hasDetail ? () => setExpanded(e => !e) : undefined}
        className={`flex items-center gap-2 px-3 py-1.5 w-full text-left ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {icon}
        <span className="font-medium">{label}</span>
        {msg.mcpServer && <span className="opacity-60">({msg.mcpServer})</span>}
        {msg.isError && <span className="ml-1 text-red-500">⚠ error</span>}
        {hasDetail && (
          <span className="ml-auto opacity-50">{expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}</span>
        )}
      </button>
      {expanded && (
        <pre className="px-3 pb-2 text-xs opacity-70 whitespace-pre-wrap break-all max-h-40 overflow-y-auto border-t border-current border-opacity-20">
          {msg.content || formatInput(msg.toolInput)}
        </pre>
      )}
    </div>
  );
}
