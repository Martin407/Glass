const API_BASE = '/api';

// To be called within components using the okta auth hook
let _getAccessToken: (() => string | undefined) | null = null;
export const setAccessTokenProvider = (provider: () => string | undefined) => {
  _getAccessToken = provider;
};

async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (_getAccessToken) {
    const token = _getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
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
};
