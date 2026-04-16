import { Loader2 } from 'lucide-react';

interface GetStartedSectionProps {
  agentsError: string | null;
  environmentsError: string | null;
  apiKeyMissing: boolean;
  canCreateSession: boolean;
  bootstrapBusy: 'agent' | 'environment' | null;
  onCreateStarterAgent: () => void;
  onCreateStarterEnvironment: () => void;
}

export function GetStartedSection({
  agentsError,
  environmentsError,
  apiKeyMissing,
  canCreateSession,
  bootstrapBusy,
  onCreateStarterAgent,
  onCreateStarterEnvironment,
}: GetStartedSectionProps) {
  return (
    <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50/90 p-5 text-sm text-gray-800">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Start your first session</h2>
      <p className="text-gray-600 mb-4">
        You need one managed agent and one cloud environment (Anthropic Managed Agents API). This app creates them through the Glass backend.
      </p>
      {(agentsError || environmentsError) && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900 space-y-1">
          {agentsError && <div>Agents: {agentsError}</div>}
          {environmentsError && <div>Environments: {environmentsError}</div>}
        </div>
      )}
      {apiKeyMissing && (
        <p className="mb-4 text-gray-700">
          Configure <code className="rounded bg-white px-1.5 py-0.5 text-xs ring-1 ring-gray-200">ANTHROPIC_API_KEY</code> for the Worker
          (for example in <code className="rounded bg-white px-1.5 py-0.5 text-xs ring-1 ring-gray-200">backend/.dev.vars</code>),
          restart the backend dev server, then refresh this page.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!!bootstrapBusy || apiKeyMissing}
          onClick={onCreateStarterAgent}
          className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {bootstrapBusy === 'agent' ? <Loader2 size={16} className="animate-spin" /> : null}
          Create starter agent
        </button>
        <button
          type="button"
          disabled={!!bootstrapBusy || apiKeyMissing}
          onClick={onCreateStarterEnvironment}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {bootstrapBusy === 'environment' ? <Loader2 size={16} className="animate-spin" /> : null}
          Create starter environment
        </button>
      </div>
      {canCreateSession && (
        <p className="mt-3 text-xs text-green-800">
          Agent and environment are loaded. Use &quot;New Session&quot; in the header to open a chat.
        </p>
      )}
    </div>
  );
}
