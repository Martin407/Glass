import { Archive, Loader2, Plus, Server, Trash2 } from 'lucide-react';
import type { Environment } from '../../types';

interface EnvironmentsSettingsProps {
  environments: Environment[];
  environmentsError: string | null;
  environmentActionBusy: string | null;
  onOpenCreate: () => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

export function EnvironmentsSettings({
  environments, environmentsError, environmentActionBusy,
  onOpenCreate, onArchive, onDelete,
}: EnvironmentsSettingsProps) {
  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-4xl">
      <h1 className="mb-2 text-2xl font-semibold">Environments</h1>
      <p className="text-sm text-gray-500 mb-6">
        Cloud environments (Anthropic Managed Agents API) define the execution context for sessions.
        The first active environment is used when creating new sessions.
      </p>
      {environmentsError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{environmentsError}</div>
      )}
      {environments.length > 0 ? (
        <div className="mb-6">
          <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
            {environments.map((env, index) => {
              const isActive = index === 0;
              const isBusy = environmentActionBusy === env.id;
              const isArchived = env.status === 'archived';
              return (
                <div key={env.id} className={`flex items-center justify-between px-4 py-3 ${isActive && !isArchived ? 'bg-blue-50' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-gray-800 truncate">{env.name || 'Unnamed environment'}</div>
                      {isActive && !isArchived && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Active</span>
                      )}
                      {isArchived && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Archived</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 font-mono mt-0.5">{env.id}</div>
                    {env.created_at && (
                      <div className="text-xs text-gray-400 mt-0.5">Created {new Date(env.created_at).toLocaleString()}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    {!isArchived && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onArchive(env.id)}
                        title="Archive environment"
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md px-2 py-1 disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
                        Archive
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onDelete(env.id)}
                      title="Delete environment"
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 border border-red-100 rounded-md px-2 py-1 disabled:opacity-50"
                    >
                      {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onOpenCreate}
            className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
          >
            <Plus size={14} /> Create another environment
          </button>
        </div>
      ) : (
        <div className="mb-6 rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <div className="rounded-full bg-gray-100 p-3 w-12 h-12 flex items-center justify-center mx-auto mb-3">
            <Server size={20} className="text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1">No environments</p>
          <p className="text-xs text-gray-400 mb-4">Create a cloud environment to run agent sessions.</p>
          <button
            type="button"
            onClick={onOpenCreate}
            className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
          >
            <Plus size={14} /> Create Environment
          </button>
        </div>
      )}
    </div>
  );
}
