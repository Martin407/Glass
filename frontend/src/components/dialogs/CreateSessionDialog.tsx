import { Loader2, MessageSquare, Plus, Trash2, X } from 'lucide-react';
import type { Agent, CredentialVault, Environment } from '../../types';

export interface GithubRepo {
  url: string;
  token: string;
}

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
  githubRepos: GithubRepo[];
  setGithubRepos: (v: GithubRepo[] | ((prev: GithubRepo[]) => GithubRepo[])) => void;
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
}

export function CreateSessionDialog({
  open, onClose, agents, environments, credentialVaults,
  agentId, setAgentId, environmentId, setEnvironmentId,
  title, setTitle, vaultId, setVaultId, githubRepos, setGithubRepos, busy, error, onSubmit,
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

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">GitHub Repositories <span className="text-gray-400 font-normal">(optional)</span></label>
              <button
                type="button"
                onClick={() => setGithubRepos(prev => [...prev, { url: '', token: '' }])}
                className="text-blue-500 hover:text-blue-600 text-xs font-medium flex items-center gap-1"
              >
                <Plus size={14} /> Add Repo
              </button>
            </div>
            {githubRepos.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No repositories attached.</p>
            ) : (
              <div className="space-y-3">
                {githubRepos.map((repo, i) => (
                  <div key={i} className="flex flex-col gap-2 p-3 border border-gray-200 rounded-md bg-gray-50">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">URL <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={repo.url}
                          onChange={e => setGithubRepos(prev => {
                            const next = [...prev];
                            next[i].url = e.target.value;
                            return next;
                          })}
                          placeholder="https://github.com/owner/repo"
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Token</label>
                        <input
                          type="password"
                          value={repo.token}
                          onChange={e => setGithubRepos(prev => {
                            const next = [...prev];
                            next[i].token = e.target.value;
                            return next;
                          })}
                          placeholder="ghp_..."
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex items-end mb-1">
                        <button
                          type="button"
                          onClick={() => setGithubRepos(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-red-500 hover:text-red-600 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
