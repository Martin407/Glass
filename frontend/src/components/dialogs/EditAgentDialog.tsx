import { Edit2, Loader2, X } from 'lucide-react';

interface EditAgentDialogProps {
  open: boolean;
  onClose: () => void;
  name: string;
  setName: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  systemPrompt: string;
  setSystemPrompt: (v: string) => void;
  speed: 'standard' | 'fast';
  setSpeed: (v: 'standard' | 'fast') => void;
  description: string;
  setDescription: (v: string) => void;
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
}

export function EditAgentDialog({
  open, onClose, name, setName, model, setModel, systemPrompt, setSystemPrompt,
  speed, setSpeed, description, setDescription, busy, error, onSubmit,
}: EditAgentDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Edit2 size={18} className="text-blue-500" /> Edit Agent</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
              <option value="claude-opus-4-6">Claude Opus 4.6</option>
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Speed</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSpeed('standard')}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${speed === 'standard' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => setSpeed('fast')}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${speed === 'fast' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              >
                Fast
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">System prompt <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              placeholder="Leave blank to keep existing system prompt..."
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy || !name.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
