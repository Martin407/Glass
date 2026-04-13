import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { agentsApi } from './agentsApi';

describe('agentsApi', () => {
  let originalFetch: typeof globalThis.fetch;
  let originalEventSource: typeof globalThis.EventSource;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalEventSource = globalThis.EventSource;
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
    vi.clearAllMocks();
  });

  const mockFetchSuccess = (data: any) => {
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => data,
    });
  };

  const mockFetchError = (status: number, text: string) => {
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: false,
      status,
      text: async () => text,
    });
  };

  describe('fetchApi helper implicitly tested via endpoints', () => {
    it('throws correct API error on non-ok response', async () => {
      mockFetchError(400, 'Bad Request Data');

      await expect(agentsApi.listAgents()).rejects.toThrow('API error: 400 - Bad Request Data');
    });

    it('returns parsed JSON on success', async () => {
      const mockData = [{ id: '1', name: 'Agent 1' }];
      mockFetchSuccess(mockData);

      const result = await agentsApi.listAgents();
      expect(result).toEqual(mockData);
    });
  });

  describe('Agent endpoints', () => {
    it('createAgent calls POST /api/agents with data', async () => {
      mockFetchSuccess({ id: '1' });
      const data = { name: 'New Agent' };

      await agentsApi.createAgent(data);

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/agents', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('listAgents calls GET /api/agents', async () => {
      mockFetchSuccess([]);

      await agentsApi.listAgents();

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/agents', {
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('getAgent calls GET /api/agents/:id', async () => {
      mockFetchSuccess({ id: '1' });

      await agentsApi.getAgent('1');

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/agents/1', {
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('updateAgent calls POST /api/agents/:id with data', async () => {
      mockFetchSuccess({ id: '1' });
      const data = { name: 'Updated Agent' };

      await agentsApi.updateAgent('1', data);

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/agents/1', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('archiveAgent calls POST /api/agents/:id/archive', async () => {
      mockFetchSuccess({ success: true });

      await agentsApi.archiveAgent('1');

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/agents/1/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('getAgentVersions calls GET /api/agents/:id/versions', async () => {
      mockFetchSuccess([{ version: 1 }]);

      await agentsApi.getAgentVersions('1');

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/agents/1/versions', {
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  describe('MCP endpoints', () => {
    it('getMcpConnections calls GET /api/mcp/connections', async () => {
      mockFetchSuccess({ connections: [] });

      await agentsApi.getMcpConnections();

      expect(global.fetch).toHaveBeenCalledWith('/api/mcp/connections', {
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('getMcpTools calls GET /api/mcp/tools/:provider', async () => {
      const toolsResponse = { read_only: [], write_delete: [] };
      mockFetchSuccess(toolsResponse);

      const result = await agentsApi.getMcpTools('google_drive');

      expect(result).toEqual(toolsResponse);
      expect(global.fetch).toHaveBeenCalledWith('/api/mcp/tools/google_drive', {
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('updateMcpToolPermission calls POST /api/mcp/tools/:provider/:toolName with properly encoded toolName and correct body', async () => {
      mockFetchSuccess({ success: true });

      await agentsApi.updateMcpToolPermission('google_drive', 'tool/name with spaces', 'allow');

      expect(global.fetch).toHaveBeenCalledWith('/api/mcp/tools/google_drive/tool%2Fname%20with%20spaces', {
        method: 'POST',
        body: JSON.stringify({ permission: 'allow' }),
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  describe('Session endpoints', () => {
    it('runSession calls POST /api/sessions/:sessionId/run', async () => {
      // runSession does not parse json immediately, returns response directly
      (globalThis.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}), // dummy
      });
      const message = 'Hello';

      await agentsApi.runSession('s1', message);

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions/s1/run', {
        method: 'POST',
        body: JSON.stringify({ message }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('runSession throws error if response is not ok', async () => {
      mockFetchError(500, 'Internal Server Error');

      await expect(agentsApi.runSession('s1', 'Hello')).rejects.toThrow('API error: 500 - Internal Server Error');
    });

    it('streamSessionEvents creates EventSource with correct URL', () => {
      const mockEventSource = vi.fn();
      globalThis.EventSource = mockEventSource as any;

      agentsApi.streamSessionEvents('s1');

      expect(mockEventSource).toHaveBeenCalledWith('/api/sessions/s1/events/stream');
    });
  });

});
