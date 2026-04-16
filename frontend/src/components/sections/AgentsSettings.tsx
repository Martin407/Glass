import React from 'react';
import { Archive, Edit2, History, Loader2, Plus, Trash2 } from 'lucide-react';
import type { Agent } from '../../types';

interface AgentsSettingsProps {
  agents: Agent[];
  agentActionBusy: string | null;
  agentVersionsAgentId: string | null;
  agentVersions: unknown[];
  agentVersionsBusy: boolean;
  selectedAgentId: string | null;
  showGetStarted: boolean;
  getStartedSection: React.ReactNode;
  onSelectAgent: (id: string) => void;
  onOpenCreate: () => void;
  onOpenEdit: (agent: Agent) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onViewVersions: (id: string) => void;
}

export function AgentsSettings({
  agents, agentActionBusy, agentVersionsAgentId, agentVersions, agentVersionsBusy,
  selectedAgentId, showGetStarted, getStartedSection,
  onSelectAgent, onOpenCreate, onOpenEdit, onArchive, onDelete, onViewVersions,
}: AgentsSettingsProps) {
  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-4xl">
      <h1 className="mb-6 text-2xl font-semibold">Agents</h1>
      {showGetStarted ? (
        getStartedSection
      ) : (
        <p className="text-sm text-gray-600 mb-6">
          Managed agent and environment are ready. Use <strong>New Session</strong> in the header to open a chat, or <strong>New Agent</strong> to create another agent.
        </p>
      )}
      {agents.length > 0 && (
        <div className="mb-6">
          <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
            {agents.map(a => {
              const isArchived = !!a.archived_at;
              const isBusy = agentActionBusy === a.id;
              const isSelected = (selectedAgentId ?? agents[0].id) === a.id;
              return (
                <div key={a.id}>
                  <div className={`flex items-center justify-between px-4 py-3 ${isSelected ? 'bg-blue-50' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-800">{a.name || 'Unnamed agent'}</div>
                        {isArchived && (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Archived</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 font-mono">{a.id}</div>
                      {a.description && <div className="text-xs text-gray-500 mt-0.5 truncate">{a.description}</div>}
                    </div>
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => onSelectAgent(a.id)}
                        className={`text-xs rounded-md px-2 py-1 font-medium ${isSelected ? 'bg-blue-100 text-blue-700' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                      >
                        {isSelected ? 'Selected' : 'Use'}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onOpenEdit(a)}
                        title="Edit agent"
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md px-2 py-1 disabled:opacity-50"
                      >
                        <Edit2 size={12} />
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onViewVersions(a.id)}
                        title="View versions"
                        className={`flex items-center gap-1 text-xs border rounded-md px-2 py-1 disabled:opacity-50 ${agentVersionsAgentId === a.id ? 'text-indigo-700 bg-indigo-50 border-indigo-200' : 'text-gray-500 hover:text-gray-700 border-gray-200'}`}
                      >
                        <History size={12} />
                        Versions
                      </button>
                      {!isArchived && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onArchive(a.id)}
                          title="Archive agent"
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md px-2 py-1 disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
                          Archive
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onDelete(a.id)}
                        title="Delete agent"
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 border border-red-100 rounded-md px-2 py-1 disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        Delete
                      </button>
                    </div>
                  </div>
                  {agentVersionsAgentId === a.id && (
                    <div className="bg-gray-50 border-t border-gray-100 px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <History size={14} className="text-gray-500" />
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Version history</span>
                        {agentVersionsBusy && <Loader2 size={12} className="animate-spin text-gray-400" />}
                      </div>
                      {agentVersionsBusy ? (
                        <div className="text-xs text-gray-400">Loading versions…</div>
                      ) : agentVersions.length === 0 ? (
                        <div className="text-xs text-gray-400">No versions found.</div>
                      ) : (
                        <div className="space-y-1">
                          {agentVersions.map((v, i) => {
                            const version = v as Record<string, unknown>;
                            return (
                              <div key={i} className="text-xs text-gray-600 flex items-center gap-2">
                                <span className="font-mono bg-gray-200 rounded px-1">{String(version.version ?? i + 1)}</span>
                                {version.created_at ? <span className="text-gray-400">{new Date(String(version.created_at)).toLocaleString()}</span> : null}
                                {version.model ? <span className="text-gray-500">{String(version.model)}</span> : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onOpenCreate}
            className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
          >
            <Plus size={14} /> Create another agent
          </button>
        </div>
      )}
    </div>
  );
}
