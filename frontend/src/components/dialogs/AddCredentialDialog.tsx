import { Key, Loader2, X } from 'lucide-react';

interface AddCredentialDialogProps {
  open: boolean;
  vaultId: string;
  onClose: () => void;
  displayName: string;
  setDisplayName: (v: string) => void;
  type: 'mcp_oauth' | 'static_bearer';
  setType: (v: 'mcp_oauth' | 'static_bearer') => void;
  mcpServerUrl: string;
  setMcpServerUrl: (v: string) => void;
  accessToken: string;
  setAccessToken: (v: string) => void;
  token: string;
  setToken: (v: string) => void;
  busy: boolean;
  error: string | null;
  onSubmit: (vaultId: string) => void;
}

export function AddCredentialDialog({
  open, vaultId, onClose, displayName, setDisplayName, type, setType,
  mcpServerUrl, setMcpServerUrl, accessToken, setAccessToken,
  token, setToken, busy, error, onSubmit,
}: AddCredentialDialogProps) {
  if (!open || !vaultId) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Key size={18} className="text-blue-500" /> Add Credential</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display name <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="My credential"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Auth type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as 'mcp_oauth' | 'static_bearer')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="mcp_oauth">MCP OAuth</option>
              <option value="static_bearer">Static Bearer</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">MCP server URL <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={mcpServerUrl}
              onChange={e => setMcpServerUrl(e.target.value)}
              placeholder="https://mcp.example.com"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {type === 'mcp_oauth' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Access token <span className="text-red-500">*</span></label>
              <input
                type="password"
                value={accessToken}
                onChange={e => setAccessToken(e.target.value)}
                placeholder="OAuth access token"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bearer token <span className="text-red-500">*</span></label>
              <input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="Bearer token"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button
            type="button"
            onClick={() => onSubmit(vaultId)}
            disabled={busy || !mcpServerUrl.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Add credential
          </button>
        </div>
      </div>
    </div>
  );
}
