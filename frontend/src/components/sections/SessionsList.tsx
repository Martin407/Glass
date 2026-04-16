import React from 'react';
import { Archive, Clock, Loader2, MessageSquare, Plus, Trash2 } from 'lucide-react';
import type { SessionRow } from '../../types';

interface SessionsListProps {
  savedSessions: SessionRow[];
  sessionActionBusy: string | null;
  canCreateSession: boolean;
  showGetStarted: boolean;
  getStartedSection: React.ReactNode;
  onOpenSession: (id: string) => void;
  onNewSession: () => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SessionsList({
  savedSessions, sessionActionBusy, canCreateSession, showGetStarted,
  getStartedSection, onOpenSession, onNewSession, onArchive, onDelete,
}: SessionsListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Recent Sessions</h1>
          <button
            type="button"
            onClick={canCreateSession ? onNewSession : undefined}
            disabled={!canCreateSession}
            title={!canCreateSession ? 'Create a managed agent and environment first (use Settings)' : 'Open a new session'}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors ${!canCreateSession ? 'cursor-not-allowed bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}
          >
            <Plus size={16} /> New Session
          </button>
        </div>

        {showGetStarted && (
          <div className="mb-8">{getStartedSection}</div>
        )}

        {savedSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-full bg-gray-100 p-4 mb-4">
              <Clock size={32} className="text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium">No sessions yet</p>
            <p className="text-sm text-gray-400 mt-1">Create a new session to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {savedSessions.map((session) => {
              const isSessionBusy = sessionActionBusy === session.id;
              return (
                <div
                  key={session.id}
                  className="w-full flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-white hover:border-gray-300 text-left transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onOpenSession(session.id)}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <div className="rounded-md bg-blue-50 p-2 flex-shrink-0">
                      <MessageSquare size={16} className="text-blue-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-mono text-sm text-gray-900 truncate">
                          {session.title || session.id.substring(0, 20) + '…'}
                        </div>
                        {session.status && (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0 ${
                            session.status === 'archived' ? 'bg-gray-100 text-gray-500' :
                            session.status === 'active' ? 'bg-green-100 text-green-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {session.status}
                          </span>
                        )}
                      </div>
                      {session.created_at && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {new Date(session.created_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </button>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    {session.status !== 'archived' && (
                      <button
                        type="button"
                        disabled={isSessionBusy}
                        onClick={() => onArchive(session.id)}
                        title="Archive session"
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md px-2 py-1 disabled:opacity-50"
                      >
                        {isSessionBusy ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
                        Archive
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isSessionBusy}
                      onClick={() => onDelete(session.id)}
                      title="Delete session"
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 border border-red-100 rounded-md px-2 py-1 disabled:opacity-50"
                    >
                      {isSessionBusy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
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
  );
}
