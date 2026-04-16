import { Loader2, MessageSquare, X } from 'lucide-react';
import type { Agent, CredentialVault, Environment } from '../../types';

interface CreateSessionDialogProps {
  open: boolean;
  onClose: () => void;
  agents: Agent[];
  environments: Environment[];
  credentialVaults: CredentialVault[];
  agentId: string;
  setAgentId: (v: string) => void;
  environmentId: string;
  setEnvironmentId: (v: string) => void;
  title: string;
  setTitle: (v: string) => void;
  vaultId: string;
  setVaultId: (v: string) => void;
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
}

export function CreateSessionDialog({
  open, onClose, agents, environments, credentialVaults,
  agentId, setAgentId, environmentId, setEnvironmentId,
  title, setTitle, vaultId, setVaultId, busy, error, onSubmit,
}: CreateSessionDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><MessageSquare size={18} className="text-blue-500" /> New Session</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agent <span className="text-red-500">*</span></label>
            <select
              value={agentId}
              onChange={e => setAgentId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name || a.id.substring(0, 16)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Environment <span className="text-red-500">*</span></label>
            <select
              value={environmentId}
              onChange={e => setEnvironmentId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {environments.map(env => (
                <option key={env.id} value={env.id}>{env.name || env.id.substring(0, 16)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Session title..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {credentialVaults.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vault <span className="text-gray-400 font-normal">(optional)</span></label>
              <select
                value={vaultId}
                onChange={e => setVaultId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No vault</option>
                {credentialVaults.map(v => (
                  <option key={v.id} value={v.id}>{v.display_name || v.id.substring(0, 16)}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy || !agentId || !environmentId}
            className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Create session
          </button>
        </div>
      </div>
    </div>
  );
}
