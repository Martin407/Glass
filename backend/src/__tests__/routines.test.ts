import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../index.js';

type DbHandlers = {
  first?: (query: string, args: unknown[]) => Promise<unknown> | unknown;
  all?: (query: string, args: unknown[]) => Promise<unknown> | unknown;
  run?: (query: string, args: unknown[]) => Promise<unknown> | unknown;
};

const createDb = (handlers: DbHandlers) => ({
  prepare: vi.fn((query: string) => ({
    bind: (...args: unknown[]) => ({
      first: async () => handlers.first?.(query, args) ?? null,
      all: async () => handlers.all?.(query, args) ?? { results: [] },
      run: async () => handlers.run?.(query, args) ?? { meta: { changes: 1 } },
    }),
  })),
});

describe('Routine trigger endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('allows API token trigger without bearer auth and uses routine owner context', async () => {
    const config = {
      id: 'cfg-1',
      user_id: 'owner-1',
      agent_id: 'agent-1',
      payload: null,
    };

    const db = createDb({
      first: (query) => query.includes('WHERE api_token') ? config : null,
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'session-1' }),
    } as Response);

    const res = await app.fetch(
      new Request('https://example.com/v1/claude_code/routines/token-123/fire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello' }),
      }),
      {
        DB: db,
        ANTHROPIC_API_KEY: 'test-key',
      } as any,
      {} as any,
    );

    expect(res.status).toBe(200);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('trigger_type = "api"'));
    expect(fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/sessions',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-okta-user-id': 'owner-1' }),
      }),
    );
  });

  it('correctly parses JSON fields in schedule-configs fetch endpoints', async () => {
    const rawConfig = {
      id: 'cfg-1',
      user_id: 'user-1',
      agent_id: 'agent-1',
      trigger_type: 'github',
      github_repo: 'owner/repo',
      github_events: JSON.stringify(['push', 'pull_request.opened']),
      github_filters: JSON.stringify({ branch: 'main' }),
      is_active: 1
    };

    const db = createDb({
      all: () => ({ results: [rawConfig] }),
      first: () => rawConfig
    });

    const listRes = await app.fetch(
      new Request('http://localhost/schedule-configs'),
      { DB: db, AUTH_BYPASS_FOR_DEV: 'true' } as any
    );

    const listData = await listRes.json() as any;
    expect(listData.data[0].github_events).toEqual(['push', 'pull_request.opened']);
    expect(listData.data[0].github_filters).toEqual({ branch: 'main' });

    const getRes = await app.fetch(
      new Request('http://localhost/schedule-configs/cfg-1'),
      { DB: db, AUTH_BYPASS_FOR_DEV: 'true' } as any
    );

    const getData = await getRes.json() as any;
    expect(getData.github_events).toEqual(['push', 'pull_request.opened']);
    expect(getData.github_filters).toEqual({ branch: 'main' });
  });

  it('rejects GitHub webhook requests with missing or invalid signature', async () => {
    const db = createDb({});

    const res = await app.fetch(
      new Request('https://example.com/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-github-event': 'push',
        },
        body: JSON.stringify({ repository: { full_name: 'owner/repo' } }),
      }),
      {
        DB: db,
        ANTHROPIC_API_KEY: 'test-key',
        GITHUB_WEBHOOK_SECRET: 'secret',
      } as any,
      {} as any,
    );

    expect(res.status).toBe(401);
  });

  it('enforces agent ownership when creating a routine', async () => {
    const db = createDb({
      first: (query) => {
        if (query.includes('SELECT user_id FROM agents')) {
          return { user_id: 'someone-else' };
        }
        return null;
      },
    });

    const res = await app.fetch(
      new Request('http://localhost/schedule-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: 'agent-1',
          trigger_type: 'schedule',
          cron_expression: '0 * * * *',
        }),
      }),
      {
        DB: db,
        AUTH_BYPASS_FOR_DEV: 'true',
      } as any,
      {} as any,
    );

    expect(res.status).toBe(403);
  });
});
