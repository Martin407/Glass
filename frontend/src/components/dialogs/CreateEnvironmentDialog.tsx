import { Loader2, Server, X } from 'lucide-react';

interface CreateEnvironmentDialogProps {
  open: boolean;
  onClose: () => void;
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  networking: 'unrestricted' | 'limited';
  setNetworking: (v: 'unrestricted' | 'limited') => void;
  allowedHosts: string;
  setAllowedHosts: (v: string) => void;
  allowMcpServers: boolean;
  setAllowMcpServers: (v: boolean) => void;
  packages: { npm: boolean; pip: boolean; apt: boolean; cargo: boolean; gem: boolean; go: boolean };
  setPackages: (updater: (prev: { npm: boolean; pip: boolean; apt: boolean; cargo: boolean; gem: boolean; go: boolean }) => { npm: boolean; pip: boolean; apt: boolean; cargo: boolean; gem: boolean; go: boolean }) => void;
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
}

export function CreateEnvironmentDialog({
  open, onClose, name, setName, description, setDescription, networking, setNetworking,
  allowedHosts, setAllowedHosts, allowMcpServers, setAllowMcpServers,
  packages, setPackages, busy, error, onSubmit,
}: CreateEnvironmentDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Server size={18} className="text-blue-500" /> New Environment</h2>
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
              placeholder="My environment"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this environment for?"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Networking</label>
            <select
              value={networking}
              onChange={e => setNetworking(e.target.value as 'unrestricted' | 'limited')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="unrestricted">Unrestricted (full internet access)</option>
              <option value="limited">Limited (restricted to allowed hosts)</option>
            </select>
          </div>
          {networking === 'limited' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Allowed hosts <span className="text-gray-400 font-normal">(comma-separated, optional)</span>
                </label>
                <input
                  type="text"
                  value={allowedHosts}
                  onChange={e => setAllowedHosts(e.target.value)}
                  placeholder="api.example.com, data.example.com"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allowMcpServers"
                  checked={allowMcpServers}
                  onChange={e => setAllowMcpServers(e.target.checked)}
                  className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                />
                <label htmlFor="allowMcpServers" className="text-sm text-gray-700">Allow MCP servers</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Package managers</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(packages) as Array<keyof typeof packages>).map(pkg => (
                    <label key={pkg} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={packages[pkg]}
                        onChange={e => setPackages(prev => ({ ...prev, [pkg]: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                      />
                      {pkg}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
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
            Create environment
          </button>
        </div>
      </div>
    </div>
  );
}
