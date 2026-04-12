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
  // Agents
  createAgent: (data: any) => fetchApi('/agents', { method: 'POST', body: JSON.stringify(data) }),
  listAgents: () => fetchApi('/agents'),
  getAgent: (id: string) => fetchApi(`/agents/${id}`),
  updateAgent: (id: string, data: any) => fetchApi(`/agents/${id}`, { method: 'POST', body: JSON.stringify(data) }),
  archiveAgent: (id: string) => fetchApi(`/agents/${id}/archive`, { method: 'POST' }),
  getAgentVersions: (id: string) => fetchApi(`/agents/${id}/versions`),

  // Sessions
  createSession: (data: any) => fetchApi('/sessions', { method: 'POST', body: JSON.stringify(data) }),
  listSessions: () => fetchApi('/sessions'),
  getSession: (id: string) => fetchApi(`/sessions/${id}`),
  updateSession: (id: string, data: any) => fetchApi(`/sessions/${id}`, { method: 'POST', body: JSON.stringify(data) }),
  deleteSession: (id: string) => fetchApi(`/sessions/${id}`, { method: 'DELETE' }),
  archiveSession: (id: string) => fetchApi(`/sessions/${id}/archive`, { method: 'POST' }),

  // Session Events
  listSessionEvents: (sessionId: string) => fetchApi(`/sessions/${sessionId}/events`),
  sendSessionEvent: (sessionId: string, data: any) => fetchApi(`/sessions/${sessionId}/events`, { method: 'POST', body: JSON.stringify(data) }),
  streamSessionEvents: (sessionId: string) => new EventSource(`${API_BASE}/sessions/${sessionId}/events/stream`),
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

  // Session Resources
  addSessionResource: (sessionId: string, data: any) => fetchApi(`/sessions/${sessionId}/resources`, { method: 'POST', body: JSON.stringify(data) }),
  listSessionResources: (sessionId: string) => fetchApi(`/sessions/${sessionId}/resources`),
  getSessionResource: (sessionId: string, resourceId: string) => fetchApi(`/sessions/${sessionId}/resources/${resourceId}`),
  updateSessionResource: (sessionId: string, resourceId: string, data: any) => fetchApi(`/sessions/${sessionId}/resources/${resourceId}`, { method: 'POST', body: JSON.stringify(data) }),
  deleteSessionResource: (sessionId: string, resourceId: string) => fetchApi(`/sessions/${sessionId}/resources/${resourceId}`, { method: 'DELETE' }),

  // Environments
  createEnvironment: (data: any) => fetchApi('/environments', { method: 'POST', body: JSON.stringify(data) }),
  listEnvironments: () => fetchApi('/environments'),
  getEnvironment: (id: string) => fetchApi(`/environments/${id}`),
  updateEnvironment: (id: string, data: any) => fetchApi(`/environments/${id}`, { method: 'POST', body: JSON.stringify(data) }),
  deleteEnvironment: (id: string) => fetchApi(`/environments/${id}`, { method: 'DELETE' }),
  archiveEnvironment: (id: string) => fetchApi(`/environments/${id}/archive`, { method: 'POST' }),

  // MCP
  getMcpConnections: () => fetchApi('/mcp/connections'),
  getMcpTools: (provider: string) => fetchApi(`/mcp/tools/${provider}`),
  updateMcpToolPermission: (provider: string, toolName: string, permission: string) => fetchApi(`/mcp/tools/${provider}/${encodeURIComponent(toolName)}`, { method: 'POST', body: JSON.stringify({ permission }) }),

};
