import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { app } from '../index';

describe('POST /agents Error Paths', () => {
  beforeEach(() => {
    vi.stubGlobal('console', {
      ...console,
      error: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle D1 agent insertion failure and attempt to archive upstream', async () => {
    const fetchMock = vi.mocked(fetch);
    // Mock the upstream agent creation success
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'agent-123' }),
    } as any);

    // Mock the upstream archive success
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as any);

    const env = {
      ANTHROPIC_API_KEY: 'test-key',
      AUTH_BYPASS_FOR_DEV: 'true',
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockRejectedValue(new Error('D1 error')),
          }),
        }),
      },
    } as any;

    const req = new Request('http://localhost/agents', {
      method: 'POST',
      body: JSON.stringify({ name: 'test agent' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await app.fetch(req, env, {} as any);
    expect(res.status).toBe(500);
    const body = await res.json() as any;
    expect(body.error).toBe('Failed to store local agent ownership after creating agent');

    // Verify upstream creation was called
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/agents',
      expect.objectContaining({ method: 'POST' })
    );

    // Verify upstream archive was called
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/agents/agent-123/archive',
      expect.objectContaining({ method: 'POST' })
    );
    expect(console.error).toHaveBeenCalledWith('Failed to store local agent ownership after creating agent', expect.any(Error));
  });

  it('should handle D1 agent insertion constraint error', async () => {
    const fetchMock = vi.mocked(fetch);
    // Mock the upstream agent creation success
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'agent-123' }),
    } as any);

    // Mock the upstream archive success
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as any);

    const env = {
      ANTHROPIC_API_KEY: 'test-key',
      AUTH_BYPASS_FOR_DEV: 'true',
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockRejectedValue({ code: '19' }), // SQLite constraint error
          }),
        }),
      },
    } as any;

    const req = new Request('http://localhost/agents', {
      method: 'POST',
      body: JSON.stringify({ name: 'test agent' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await app.fetch(req, env, {} as any);
    expect(res.status).toBe(409);
    const body = await res.json() as any;
    expect(body.error).toBe('Agent already exists');
  });
});
