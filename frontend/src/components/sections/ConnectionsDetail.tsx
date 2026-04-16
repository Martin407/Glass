import { ChevronDown, Loader2, MoreVertical, RefreshCw, Zap } from 'lucide-react';
import { MessageSquare } from 'lucide-react';
import { PermissionToggle } from '../PermissionToggle';
import type { AppProvider, McpTool } from '../../types';

const OAUTH_PROVIDERS = new Set(['Linear', 'Slack', 'Notion', 'Figma']);

interface ConnectionsDetailProps {
  selectedProvider: string;
  selectedApp: AppProvider;
  readOnlyTools: McpTool[];
  writeDeleteTools: McpTool[];
  refreshToolsBusy: boolean;
  connectingProvider: string | null;
  onRefreshTools: () => void;
  onConnect: (provider: string) => void;
  onToggle: (toolName: string, newStatus: string, type: 'read_only' | 'write_delete') => void;
}

export function ConnectionsDetail({
  selectedProvider, selectedApp, readOnlyTools, writeDeleteTools,
  refreshToolsBusy, connectingProvider, onRefreshTools, onConnect, onToggle,
}: ConnectionsDetailProps) {
  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-4xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <MessageSquare size={28} className="text-blue-500" />
            <h1 className="text-2xl font-semibold">{selectedProvider}</h1>
            {selectedApp.connected ? (
              <div className="ml-2 flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
                Connected
              </div>
            ) : (
              <div className="ml-2 flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-500">
                <div className="h-1.5 w-1.5 rounded-full bg-gray-400"></div>
                Not connected
              </div>
            )}
          </div>
          <p className="mt-4 max-w-2xl text-sm text-gray-500">
            Search messages, access channels, read threads, and stay connected with your team&apos;s
            communications. Find relevant discussions and context quickly.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {OAUTH_PROVIDERS.has(selectedProvider) && selectedApp.connected && (
            <button
              type="button"
              disabled={refreshToolsBusy}
              onClick={onRefreshTools}
              className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw size={14} className={refreshToolsBusy ? 'animate-spin' : ''} />
              {refreshToolsBusy ? 'Refreshing…' : 'Refresh tools'}
            </button>
          )}
          {OAUTH_PROVIDERS.has(selectedProvider) && !selectedApp.connected && (
            <button
              type="button"
              disabled={connectingProvider === selectedProvider}
              onClick={() => onConnect(selectedProvider)}
              className="flex items-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {connectingProvider === selectedProvider ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              {connectingProvider === selectedProvider ? 'Connecting…' : `Connect with ${selectedProvider}`}
            </button>
          )}
          <button type="button" className="text-gray-400 hover:text-gray-600" aria-label="More options">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="mb-1 text-lg font-semibold">Tool permissions</h2>
        <p className="mb-6 text-sm text-gray-500">Choose when the agent is allowed to use these tools.</p>

        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-2 text-xs font-semibold text-gray-500">
            <div className="flex items-center tracking-wider">
              <ChevronDown size={14} className="mr-1" />
              READ-ONLY TOOLS
            </div>
            <div className="flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-gray-600">
              Allow <ChevronDown size={14} />
            </div>
          </div>
          <div className="space-y-0">
            {readOnlyTools.map((tool, index) => (
              <div key={index} className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0">
                <span className="text-sm text-gray-700">{tool.name}</span>
                <PermissionToggle status={tool.status} onToggle={(newStatus) => onToggle(tool.name, newStatus, 'read_only')} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-2 text-xs font-semibold text-gray-500">
            <div className="flex items-center tracking-wider">
              <ChevronDown size={14} className="mr-1" />
              WRITE/DELETE TOOLS
            </div>
            <div className="flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-gray-600">
              Mixed <ChevronDown size={14} />
            </div>
          </div>
          <div className="space-y-0">
            {writeDeleteTools.map((tool, index) => (
              <div key={index} className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0">
                <span className="text-sm text-gray-700">{tool.name}</span>
                <PermissionToggle status={tool.status} onToggle={(newStatus) => onToggle(tool.name, newStatus, 'write_delete')} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
