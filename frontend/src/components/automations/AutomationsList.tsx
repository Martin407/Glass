import { useState, useEffect, type FormEvent } from 'react';
import { Calendar, Loader2, Plus, Trash2, Edit2, Play, Pause } from 'lucide-react';
import { agentsApi } from '../../lib/agentsApi';
import type { ScheduleConfig, Agent } from '../../types';

interface AutomationsListProps {
  agents: Agent[];
}

export function AutomationsList({ agents }: AutomationsListProps) {
  const [configs, setConfigs] = useState<ScheduleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ScheduleConfig | null>(null);
  const [agentId, setAgentId] = useState('');
  const [cronExpression, setCronExpression] = useState('0 * * * *');
  const [triggerType, setTriggerType] = useState<'schedule'|'api'|'github'>('schedule');
  const [githubRepo, setGithubRepo] = useState('');
  const [githubEvents, setGithubEvents] = useState('[]');
  const [githubFilters, setGithubFilters] = useState('{}');
  const [payloadStr, setPayloadStr] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await agentsApi.listScheduleConfigs() as { data?: ScheduleConfig[] };
      setConfigs(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingConfig(null);
    setAgentId(agents[0]?.id || '');
    setCronExpression('0 * * * *');
    setTriggerType('schedule');
    setGithubRepo('');
    setGithubEvents('[]');
    setGithubFilters('{}');
    setPayloadStr('');
    setFormError(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (config: ScheduleConfig) => {
    setEditingConfig(config);
    setAgentId(config.agent_id);
    setCronExpression(config.cron_expression);
    setTriggerType(config.trigger_type || 'schedule');
    setGithubRepo(config.github_repo || '');
    setGithubEvents(config.github_events ? JSON.stringify(config.github_events) : '[]');
    setGithubFilters(config.github_filters ? JSON.stringify(config.github_filters) : '{}');
    setPayloadStr(config.payload || '');
    setFormError(null);
    setIsDialogOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setFormBusy(true);
    setFormError(null);

    let payloadValue: unknown = null;
    if (payloadStr.trim()) {
      try {
        payloadValue = JSON.parse(payloadStr);
      } catch {
        setFormError('Invalid JSON in payload');
        setFormBusy(false);
        return;
      }
    }

    let githubEventsValue: unknown[] | null = null;
    let githubFiltersValue: Record<string, unknown> | null = null;
    if (triggerType === 'github') {
      if (githubEvents.trim()) {
        try {
          const parsed = JSON.parse(githubEvents) as unknown;
          if (!Array.isArray(parsed)) {
            throw new Error('GitHub events must be a JSON array');
          }
          githubEventsValue = parsed;
        } catch {
          setFormError('Invalid JSON in GitHub events (expected JSON array)');
          setFormBusy(false);
          return;
        }
      }

      if (githubFilters.trim()) {
        try {
          const parsed = JSON.parse(githubFilters) as unknown;
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            throw new Error('GitHub filters must be a JSON object');
          }
          githubFiltersValue = parsed as Record<string, unknown>;
        } catch {
          setFormError('Invalid JSON in GitHub filters (expected JSON object)');
          setFormBusy(false);
          return;
        }
      }
    }

    try {

      const data = {
        agent_id: agentId,
        trigger_type: triggerType,
        cron_expression: triggerType === 'schedule' ? cronExpression : '',
        payload: payloadValue,
        github_repo: triggerType === 'github' ? githubRepo : null,
        github_events: triggerType === 'github' ? githubEventsValue : null,
        github_filters: triggerType === 'github' ? githubFiltersValue : null,
      };

      if (editingConfig) {
        await agentsApi.updateScheduleConfig(editingConfig.id, data);
      } else {
        await agentsApi.createScheduleConfig(data);
      }

      setIsDialogOpen(false);
      loadConfigs();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setFormBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this routine?')) return;
    try {
      await agentsApi.deleteScheduleConfig(id);
      loadConfigs();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleToggleActive = async (config: ScheduleConfig) => {
    try {
      const newActive = config.is_active ? 0 : 1;
      await agentsApi.updateScheduleConfig(config.id, { is_active: newActive });
      loadConfigs();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const getAgentName = (id: string) => agents.find(a => a.id === id)?.name || id.substring(0, 8);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Routines</h1>
            <p className="text-gray-500 mt-1 text-sm">Automate your agents to run on a schedule</p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors bg-blue-500 hover:bg-blue-600"
          >
            <Plus size={16} /> New Routine
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-blue-500" />
          </div>
        ) : configs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-full bg-gray-100 p-4 mb-4">
              <Calendar size={32} className="text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium">No routines yet</p>
            <p className="text-sm text-gray-400 mt-1">Create a routine to run an agent on a schedule.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {configs.map((config) => (
              <div key={config.id} className={`flex flex-col gap-3 p-5 rounded-lg border ${config.is_active ? 'border-gray-200 bg-white hover:border-gray-300' : 'border-gray-100 bg-gray-50 opacity-70'} transition-colors`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-md p-2 ${config.is_active ? 'bg-blue-50 text-blue-500' : 'bg-gray-100 text-gray-400'}`}>
                      <Calendar size={18} />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 flex items-center gap-2">
                        {getAgentName(config.agent_id)}
                        <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                          {config.trigger_type === 'schedule' ? config.cron_expression : config.trigger_type}
                        </span>
                        {!config.is_active && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-md">Paused</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-0.5 font-mono truncate max-w-md">
                        {config.payload || 'No payload'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(config)}
                      className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                      title={config.is_active ? 'Pause routine' : 'Resume routine'}
                    >
                      {config.is_active ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(config)}
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title="Edit routine"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(config.id)}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete routine"
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

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl flex flex-col max-h-[90vh]">
            <div className="border-b border-gray-100 px-6 py-4 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingConfig ? 'Edit Routine' : 'New Routine'}
              </h2>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto">
                {formError && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                    {formError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Agent</label>
                  <select
                    required
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="" disabled>Select an agent...</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Trigger Type</label>
                  <select
                    required
                    value={triggerType}
                    onChange={(e) => setTriggerType(e.target.value as 'schedule' | 'api' | 'github')}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="schedule">Schedule (Cron)</option>
                    <option value="api">API Endpoint</option>
                    <option value="github">GitHub Event</option>
                  </select>
                </div>

                {triggerType === 'schedule' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Schedule (Cron)</label>
                  <input
                    type="text"
                    required
                    value={cronExpression}
                    onChange={(e) => setCronExpression(e.target.value)}
                    placeholder="0 * * * *"
                    className="w-full font-mono rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500">Standard cron format (e.g. "0 * * * *" for hourly)</p>
                </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Initial Prompt (JSON object)</label>
                  <textarea
                    value={payloadStr}
                    onChange={(e) => setPayloadStr(e.target.value)}
                    placeholder='{"message": "Check for new PRs"}'
                    className="w-full font-mono rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 h-24"
                  />
                  <p className="text-xs text-gray-500">Optional JSON payload to start the session</p>
                </div>

                {editingConfig && triggerType === 'api' && editingConfig.api_token && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">API Token</label>
                    <div className="w-full font-mono bg-gray-100 rounded-md border border-gray-300 px-3 py-2 text-sm">
                      {editingConfig.api_token}
                    </div>
                    <p className="text-xs text-gray-500">Endpoint: POST /v1/claude_code/routines/{editingConfig.api_token}/fire</p>
                  </div>
                )}

                {triggerType === 'github' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">GitHub Repository</label>
                      <input
                        type="text"
                        value={githubRepo}
                        onChange={(e) => setGithubRepo(e.target.value)}
                        placeholder="owner/repo"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">GitHub Events (JSON array)</label>
                      <input
                        type="text"
                        value={githubEvents}
                        onChange={(e) => setGithubEvents(e.target.value)}
                        placeholder='["pull_request.opened"]'
                        className="w-full font-mono rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 flex justify-end gap-2 flex-shrink-0 rounded-b-xl">
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formBusy}
                  className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {formBusy && <Loader2 size={16} className="animate-spin" />}
                  {editingConfig ? 'Save Changes' : 'Create Routine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
