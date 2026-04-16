const API_BASE = '/api';

async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }
  return response.json();
}

export const agentsApi = {
  // ── Agents ──────────────────────────────────────────────────────────────────
  createAgent: (data: Record<string, unknown>) =>
    fetchApi('/agents', { method: 'POST', body: JSON.stringify(data) }),
  listAgents: (params?: { include_archived?: boolean; limit?: number; page?: string }) => {
    const qs = new URLSearchParams();
    if (params?.include_archived) qs.set('include_archived', 'true');
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.page) qs.set('page', params.page);
    const query = qs.toString() ? `?${qs}` : '';
    return fetchApi(`/agents${query}`);
  },
  getAgent: (id: string, version?: number) => {
    const qs = version !== undefined ? `?version=${version}` : '';
    return fetchApi(`/agents/${id}${qs}`);
  },
  updateAgent: (id: string, data: Record<string, unknown>) =>
    fetchApi(`/agents/${id}`, { method: 'POST', body: JSON.stringify(data) }),
  deleteAgent: (id: string) =>
    fetchApi(`/agents/${id}`, { method: 'DELETE' }),
  archiveAgent: (id: string) =>
    fetchApi(`/agents/${id}/archive`, { method: 'POST' }),
  getAgentVersions: (id: string) =>
    fetchApi(`/agents/${id}/versions`),

  // ── Sessions ─────────────────────────────────────────────────────────────────
  createSession: (data: Record<string, unknown>) =>
    fetchApi('/sessions', { method: 'POST', body: JSON.stringify(data) }),
  listSessions: (params?: {
    agent_id?: string;
    include_archived?: boolean;
    limit?: number;
    order?: 'asc' | 'desc';
    page?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.agent_id) qs.set('agent_id', params.agent_id);
    if (params?.include_archived) qs.set('include_archived', 'true');
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.order) qs.set('order', params.order);
    if (params?.page) qs.set('page', params.page);
    const query = qs.toString() ? `?${qs}` : '';
    return fetchApi(`/sessions${query}`);
  },
  getSession: (id: string) => fetchApi(`/sessions/${id}`),
  updateSession: (id: string, data: Record<string, unknown>) =>
    fetchApi(`/sessions/${id}`, { method: 'POST', body: JSON.stringify(data) }),
  deleteSession: (id: string) =>
    fetchApi(`/sessions/${id}`, { method: 'DELETE' }),
  archiveSession: (id: string) =>
    fetchApi(`/sessions/${id}/archive`, { method: 'POST' }),

  // ── Session Events ────────────────────────────────────────────────────────────
  listSessionEvents: (sessionId: string, params?: { limit?: number; order?: 'asc' | 'desc'; page?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.order) qs.set('order', params.order);
    if (params?.page) qs.set('page', params.page);
    const query = qs.toString() ? `?${qs}` : '';
    return fetchApi(`/sessions/${sessionId}/events${query}`);
  },
  sendSessionEvent: (sessionId: string, data: Record<string, unknown>) =>
    fetchApi(`/sessions/${sessionId}/events`, { method: 'POST', body: JSON.stringify(data) }),
  streamSessionEvents: (sessionId: string) =>
    new EventSource(`${API_BASE}/sessions/${sessionId}/events/stream`),
  runSession: async (sessionId: string, message: string, options?: RequestInit) => {
    const response = await fetch(`${API_BASE}/sessions/${sessionId}/run`, {
      method: 'POST',
      body: JSON.stringify({ message }),
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }
    return response;
  },
  /** Send a user.interrupt event to stop the running session. */
  interruptSession: (sessionId: string) =>
    fetchApi(`/sessions/${sessionId}/events`, {
      method: 'POST',
      body: JSON.stringify({ events: [{ type: 'user.interrupt' }] }),
    }),
  /** Send a user.tool_confirmation event (allow or deny a tool use). */
  confirmTool: (sessionId: string, toolUseId: string, result: 'allow' | 'deny', denyMessage?: string) =>
    fetchApi(`/sessions/${sessionId}/events`, {
      method: 'POST',
      body: JSON.stringify({
        events: [{
          type: 'user.tool_confirmation',
          tool_use_id: toolUseId,
          result,
          ...(denyMessage ? { deny_message: denyMessage } : {}),
        }],
      }),
    }),
  /** Send a user.custom_tool_result event. */
  sendCustomToolResult: (
    sessionId: string,
    customToolUseId: string,
    content: Array<{ type: 'text'; text: string }>,
    isError?: boolean,
  ) =>
    fetchApi(`/sessions/${sessionId}/events`, {
      method: 'POST',
      body: JSON.stringify({
        events: [{
          type: 'user.custom_tool_result',
          custom_tool_use_id: customToolUseId,
          content,
          ...(isError !== undefined ? { is_error: isError } : {}),
        }],
      }),
    }),

  // ── Session Resources ─────────────────────────────────────────────────────────
  addSessionResource: (sessionId: string, data: Record<string, unknown>) =>
    fetchApi(`/sessions/${sessionId}/resources`, { method: 'POST', body: JSON.stringify(data) }),
  listSessionResources: (sessionId: string) =>
    fetchApi(`/sessions/${sessionId}/resources`),
  getSessionResource: (sessionId: string, resourceId: string) =>
    fetchApi(`/sessions/${sessionId}/resources/${resourceId}`),
  updateSessionResource: (sessionId: string, resourceId: string, data: Record<string, unknown>) =>
    fetchApi(`/sessions/${sessionId}/resources/${resourceId}`, { method: 'POST', body: JSON.stringify(data) }),
  deleteSessionResource: (sessionId: string, resourceId: string) =>
    fetchApi(`/sessions/${sessionId}/resources/${resourceId}`, { method: 'DELETE' }),


  // ── Schedule Configs ──────────────────────────────────────────────────────────
  createScheduleConfig: (data: Record<string, unknown>) =>
    fetchApi('/schedule-configs', { method: 'POST', body: JSON.stringify(data) }),
  listScheduleConfigs: () =>
    fetchApi('/schedule-configs'),
  getScheduleConfig: (id: string) => fetchApi(`/schedule-configs/${id}`),
  updateScheduleConfig: (id: string, data: Record<string, unknown>) =>
    fetchApi(`/schedule-configs/${id}`, { method: 'POST', body: JSON.stringify(data) }),
  deleteScheduleConfig: (id: string) =>
    fetchApi(`/schedule-configs/${id}`, { method: 'DELETE' }),

// ── Environments ──────────────────────────────────────────────────────────────
  createEnvironment: (data: Record<string, unknown>) =>
    fetchApi('/environments', { method: 'POST', body: JSON.stringify(data) }),
  listEnvironments: (params?: { include_archived?: boolean; limit?: number; page?: string }) => {
    const qs = new URLSearchParams();
    if (params?.include_archived) qs.set('include_archived', 'true');
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.page) qs.set('page', params.page);
    const query = qs.toString() ? `?${qs}` : '';
    return fetchApi(`/environments${query}`);
  },
  getEnvironment: (id: string) => fetchApi(`/environments/${id}`),
  updateEnvironment: (id: string, data: Record<string, unknown>) =>
    fetchApi(`/environments/${id}`, { method: 'POST', body: JSON.stringify(data) }),
  deleteEnvironment: (id: string) =>
    fetchApi(`/environments/${id}`, { method: 'DELETE' }),
  archiveEnvironment: (id: string) =>
    fetchApi(`/environments/${id}/archive`, { method: 'POST' }),

  // ── MCP ───────────────────────────────────────────────────────────────────────
  getMcpConnections: () => fetchApi('/mcp/connections'),
  getMcpTools: (provider: string) => fetchApi(`/mcp/tools/${provider}`),
  updateMcpToolPermission: (provider: string, toolName: string, permission: string) =>
    fetchApi(`/mcp/tools/${provider}/${encodeURIComponent(toolName)}`, {
      method: 'POST',
      body: JSON.stringify({ permission }),
    }),
  refreshMcpTools: (provider: string) =>
    fetchApi(`/mcp/${encodeURIComponent(provider)}/tools/refresh`, { method: 'POST' }),

  // ── MCP OAuth ─────────────────────────────────────────────────────────────────
  getProviderAuthUrl: (provider: string, returnTo: string) =>
    fetchApi(`/integrations/${encodeURIComponent(provider)}/authorize?return_to=${encodeURIComponent(returnTo)}`),
  disconnectProvider: (provider: string) =>
    fetchApi(`/integrations/${encodeURIComponent(provider)}/disconnect`, { method: 'DELETE' }),

  // ── Credential Vaults ─────────────────────────────────────────────────────────
  listCredentialVaults: () => fetchApi('/credential-vaults'),
  createCredentialVault: (data: Record<string, unknown>) =>
    fetchApi('/credential-vaults', { method: 'POST', body: JSON.stringify(data) }),
  getCredentialVault: (vaultId: string) =>
    fetchApi(`/credential-vaults/${encodeURIComponent(vaultId)}`),
  updateCredentialVault: (vaultId: string, data: Record<string, unknown>) =>
    fetchApi(`/credential-vaults/${encodeURIComponent(vaultId)}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  archiveCredentialVault: (vaultId: string) =>
    fetchApi(`/credential-vaults/${encodeURIComponent(vaultId)}/archive`, { method: 'POST' }),
  deleteCredentialVault: (vaultId: string) =>
    fetchApi(`/credential-vaults/${encodeURIComponent(vaultId)}`, { method: 'DELETE' }),

  // ── Vault Credentials ─────────────────────────────────────────────────────────
  listVaultCredentials: (vaultId: string) =>
    fetchApi(`/credential-vaults/${encodeURIComponent(vaultId)}/credentials`),
  addVaultCredential: (vaultId: string, data: Record<string, unknown>) =>
    fetchApi(`/credential-vaults/${encodeURIComponent(vaultId)}/credentials`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getVaultCredential: (vaultId: string, credentialId: string) =>
    fetchApi(`/credential-vaults/${encodeURIComponent(vaultId)}/credentials/${encodeURIComponent(credentialId)}`),
  updateVaultCredential: (vaultId: string, credentialId: string, data: Record<string, unknown>) =>
    fetchApi(`/credential-vaults/${encodeURIComponent(vaultId)}/credentials/${encodeURIComponent(credentialId)}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteVaultCredential: (vaultId: string, credentialId: string) =>
    fetchApi(`/credential-vaults/${encodeURIComponent(vaultId)}/credentials/${encodeURIComponent(credentialId)}`, {
      method: 'DELETE',
    }),
  archiveVaultCredential: (vaultId: string, credentialId: string) =>
    fetchApi(`/credential-vaults/${encodeURIComponent(vaultId)}/credentials/${encodeURIComponent(credentialId)}/archive`, {
      method: 'POST',
    }),
};
