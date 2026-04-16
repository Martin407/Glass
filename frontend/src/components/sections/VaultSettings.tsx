import { Archive, Database, Key, Loader2, Plus, Shield, Trash2 } from 'lucide-react';
import type { AppProvider, CredentialVault, VaultCredential } from '../../types';

interface VaultSettingsProps {
  credentialVaults: CredentialVault[];
  vaultCredentials: VaultCredential[];
  vaultCredentialsBusy: boolean;
  vaultBusy: boolean;
  vaultError: string | null;
  connectedProviders: AppProvider[];
  canCreateSession: boolean;
  newVaultDisplayName: string;
  setNewVaultDisplayName: (v: string) => void;
  newVaultDescription: string;
  setNewVaultDescription: (v: string) => void;
  credentialActionBusy: string | null;
  onCreateVault: () => void;
  onDeleteVault: (id: string) => void;
  onOpenAddCredential: () => void;
  onArchiveCredential: (vaultId: string, credId: string) => void;
  onDeleteCredential: (vaultId: string, credId: string) => void;
}

export function VaultSettings({
  credentialVaults, vaultCredentials, vaultCredentialsBusy, vaultBusy, vaultError,
  connectedProviders, canCreateSession, newVaultDisplayName, setNewVaultDisplayName,
  newVaultDescription, setNewVaultDescription, credentialActionBusy,
  onCreateVault, onDeleteVault, onOpenAddCredential, onArchiveCredential, onDeleteCredential,
}: VaultSettingsProps) {
  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-4xl">
      <h1 className="mb-2 text-2xl font-semibold">Credential Vault</h1>
      <p className="text-sm text-gray-500 mb-6">
        The Managed Agents Credential Vault stores your MCP OAuth tokens on Anthropic&apos;s servers.
        Sessions you create automatically receive access to all connected MCP tools via the vault.
      </p>

      {vaultError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{vaultError}</div>
      )}

      {credentialVaults.length === 0 ? (
        <div className="mb-6 rounded-lg border border-dashed border-gray-300 p-6">
          <div className="text-center mb-4">
            <div className="rounded-full bg-gray-100 p-3 w-12 h-12 flex items-center justify-center mx-auto mb-3">
              <Database size={20} className="text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">No credential vault</p>
            <p className="text-xs text-gray-400 mb-4">Create a vault to securely store your MCP credentials on Anthropic&apos;s servers.</p>
          </div>
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display name <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="text"
                value={newVaultDisplayName}
                onChange={e => setNewVaultDisplayName(e.target.value)}
                placeholder="My vault"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="text"
                value={newVaultDescription}
                onChange={e => setNewVaultDescription(e.target.value)}
                placeholder="What is this vault for?"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-center">
            <button
              type="button"
              disabled={vaultBusy || !canCreateSession}
              onClick={onCreateVault}
              title={!canCreateSession ? 'Configure an agent and environment first' : undefined}
              className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {vaultBusy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create Credential Vault
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-6">
          {credentialVaults.map(vault => (
            <div key={vault.id} className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-green-900">{vault.display_name || 'Vault active'}</span>
                </div>
                <div className="font-mono text-xs text-green-700">{vault.id}</div>
                {vault.description && <div className="text-xs text-green-600 mt-0.5">{vault.description}</div>}
                {vault.created_at && (
                  <div className="text-xs text-green-600 mt-0.5">Created {new Date(vault.created_at).toLocaleString()}</div>
                )}
              </div>
              <button
                type="button"
                disabled={vaultBusy}
                onClick={() => onDeleteVault(vault.id)}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          ))}

          <div className="mt-6 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-gray-500" />
                <h2 className="text-base font-semibold text-gray-800">Credentials</h2>
                {vaultCredentialsBusy && <Loader2 size={14} className="animate-spin text-gray-400" />}
              </div>
              <button
                type="button"
                onClick={onOpenAddCredential}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
              >
                <Plus size={14} /> Add Credential
              </button>
            </div>
            {vaultCredentials.length === 0 && !vaultCredentialsBusy ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center">
                <Key size={20} className="text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No credentials yet. Add one to inject MCP tokens into sessions.</p>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
                {vaultCredentials.map(cred => {
                  const isCredBusy = credentialActionBusy === cred.id;
                  const isArchived = !!cred.archived_at;
                  const vaultId = credentialVaults[0].id;
                  return (
                    <div key={cred.id} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Key size={14} className="text-gray-400 flex-shrink-0" />
                          <div className="text-sm font-medium text-gray-800 truncate">
                            {cred.display_name || cred.id.substring(0, 16)}
                          </div>
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 flex-shrink-0">
                            {cred.auth.type === 'mcp_oauth' ? 'MCP OAuth' : 'Static Bearer'}
                          </span>
                          {isArchived && (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 flex-shrink-0">Archived</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 truncate">{cred.auth.mcp_server_url}</div>
                      </div>
                      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                        {!isArchived && (
                          <button
                            type="button"
                            disabled={isCredBusy}
                            onClick={() => onArchiveCredential(vaultId, cred.id)}
                            title="Archive credential"
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md px-2 py-1 disabled:opacity-50"
                          >
                            {isCredBusy ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
                            Archive
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isCredBusy}
                          onClick={() => onDeleteCredential(vaultId, cred.id)}
                          title="Delete credential"
                          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 border border-red-100 rounded-md px-2 py-1 disabled:opacity-50"
                        >
                          {isCredBusy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mb-2">
        <h2 className="text-base font-semibold text-gray-800 mb-1">MCP Credentials in Vault</h2>
        <p className="text-xs text-gray-500 mb-4">
          These connected providers&apos; OAuth tokens are automatically injected into new sessions as MCP servers.
        </p>
        {connectedProviders.length === 0 ? (
          <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-500">
            No providers connected. Go to <strong>Integrations</strong> or <strong>Connections</strong> to connect Slack, Linear, Notion, or Figma.
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
            {connectedProviders.map(app => (
              <div key={app.name} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <app.icon size={16} className={app.color} />
                  <span className="text-sm font-medium text-gray-800">{app.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    OAuth token stored
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
