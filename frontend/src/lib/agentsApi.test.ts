import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { agentsApi } from './agentsApi';

describe('agentsApi', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('runSession', () => {
    it('throws an error with status and text when response is not ok', async () => {
      const mockSessionId = 'session-123';
      const mockMessage = 'hello';

      const mockErrorResponse = {
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('Bad Request'),
      } as unknown as Response;

      vi.mocked(global.fetch).mockResolvedValueOnce(mockErrorResponse);

      await expect(agentsApi.runSession(mockSessionId, mockMessage)).rejects.toThrow(
        'API error: 400 - Bad Request'
      );

      expect(global.fetch).toHaveBeenCalledWith(`/api/sessions/${mockSessionId}/run`, expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: mockMessage }),
      }));
    });

    it('returns response when successful', async () => {
      const mockSessionId = 'session-123';
      const mockMessage = 'hello';

      const mockSuccessResponse = {
        ok: true,
        status: 200,
      } as unknown as Response;

      vi.mocked(global.fetch).mockResolvedValueOnce(mockSuccessResponse);

      const response = await agentsApi.runSession(mockSessionId, mockMessage);

      expect(response).toBe(mockSuccessResponse);
      expect(global.fetch).toHaveBeenCalledWith(`/api/sessions/${mockSessionId}/run`, expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: mockMessage }),
      }));
    });
  });

  describe('fetchApi wrappers', () => {
    it('throws an error with status and text when response is not ok', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Internal Server Error'),
      } as unknown as Response;

      vi.mocked(global.fetch).mockResolvedValueOnce(mockErrorResponse);

      await expect(agentsApi.listAgents()).rejects.toThrow(
        'API error: 500 - Internal Server Error'
      );
    });

    it('returns json when successful', async () => {
      const mockData = { agents: [] };
      const mockSuccessResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockData),
      } as unknown as Response;

      vi.mocked(global.fetch).mockResolvedValueOnce(mockSuccessResponse);

      const response = await agentsApi.listAgents();

      expect(response).toEqual(mockData);
    });
  });
});
