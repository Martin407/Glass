import { Loader2 } from 'lucide-react';
import type { AppProvider } from '../../types';

const OAUTH_PROVIDERS = new Set(['Linear', 'Slack', 'Notion', 'Figma']);

interface IntegrationsGridProps {
  appState: AppProvider[];
  connectingProvider: string | null;
  onConnect: (provider: string) => void;
  onNavigate: (provider: string) => void;
}

export function IntegrationsGrid({ appState, connectingProvider, onConnect, onNavigate }: IntegrationsGridProps) {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Integrations</h1>
        <p className="text-sm text-gray-500 mb-8">Connect your tools and services to give agents access to your data.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {appState.map((app) => {
            const canConnect = OAUTH_PROVIDERS.has(app.name) && !app.connected;
            const isConnecting = connectingProvider === app.name;
            return (
              <div
                key={app.name}
                onClick={() => onNavigate(app.name)}
                className="flex flex-col items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left hover:border-blue-300 hover:bg-blue-50/50 transition-colors cursor-pointer"
              >
                <div className="flex w-full items-center justify-between">
                  <app.icon size={20} className={app.color} />
                  {app.connected && <div className="h-2 w-2 rounded-full bg-green-500" />}
                </div>
                <div className="flex-1 w-full">
                  <div className="text-sm font-medium text-gray-900">{app.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{app.connected ? 'Connected' : 'Not connected'}</div>
                </div>
                {canConnect && (
                  <button
                    type="button"
                    disabled={isConnecting}
                    onClick={(e) => { e.stopPropagation(); onConnect(app.name); }}
                    className="w-full rounded-md bg-indigo-500 px-2 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                  >
                    {isConnecting ? <Loader2 size={12} className="animate-spin" /> : null}
                    {isConnecting ? 'Connecting…' : 'Connect'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
