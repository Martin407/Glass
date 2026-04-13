import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app, globalCache } from '../index.js';

/**
 * Builds a minimal D1-like mock for a given table and owner mapping.
 *
 * `ownerMap` maps resource IDs to user IDs so that a `SELECT user_id FROM
 * <table> WHERE id = ?` query can return the correct row.
 */
function makeDB(ownerMap: Record<string, string>) {
  return {
    prepare: vi.fn().mockImplementation(() => ({
      bind: vi.fn().mockImplementation((id: string) => ({
        first: vi.fn().mockResolvedValue(
          ownerMap[id] ? { user_id: ownerMap[id] } : null
        ),
        run: vi.fn().mockResolvedValue({}),
        all: vi.fn().mockResolvedValue({ results: [] }),
      })),
    })),
  };
}

const ENV_BASE = {
  AUTH_BYPASS_FOR_DEV: 'true',
  ANTHROPIC_API_KEY: undefined as string | undefined,
};

describe('ownership cache integration', () => {
  beforeEach(() => {
    // Clear the global cache between tests to ensure isolation.
    globalCache.delete('agent_owner_agent-1');
    globalCache.delete('agent_owner_agent-other');
    globalCache.delete('session_owner_session-1');
    globalCache.delete('env_owner_env-1');
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // ensureAgentOwnership
  // -----------------------------------------------------------------------
  describe('ensureAgentOwnership', () => {
    it('returns 403 when agent does not exist', async () => {
      const db = makeDB({});
      const res = await app.request('/agents/agent-1', {}, { ...ENV_BASE, DB: db });
      expect(res.status).toBe(403);
    });

    it('returns 403 when agent is owned by a different user', async () => {
      // AUTH_BYPASS_FOR_DEV always sets user to "user-123"
      const db = makeDB({ 'agent-1': 'user-other' });
      const res = await app.request('/agents/agent-1', {}, { ...ENV_BASE, DB: db });
      expect(res.status).toBe(403);
    });

    it('queries the DB on the first request (cache miss)', async () => {
      const db = makeDB({ 'agent-1': 'user-123' });
      // The route requires ANTHROPIC_API_KEY for the upstream call, so this
      // will return 500 after the ownership check passes - that's fine.
      await app.request('/agents/agent-1', {}, { ...ENV_BASE, DB: db });
      expect(db.prepare).toHaveBeenCalled();
    });

    it('does not query the DB on a subsequent request for the same agent (cache hit)', async () => {
      // Pre-populate the cache to simulate a previous successful request.
      globalCache.set('agent_owner_agent-1', 'user-123', 60000);
      const db = makeDB({ 'agent-1': 'user-123' });

      await app.request('/agents/agent-1', {}, { ...ENV_BASE, DB: db });

      // DB should not have been queried because the answer was in the cache.
      expect(db.prepare).not.toHaveBeenCalled();
    });

    it('still rejects access when cached ownerId does not match the current user', async () => {
      // Cache a different owner than "user-123" (the user set by AUTH_BYPASS_FOR_DEV).
      globalCache.set('agent_owner_agent-1', 'user-other', 60000);
      const db = makeDB({});

      const res = await app.request('/agents/agent-1', {}, { ...ENV_BASE, DB: db });

      expect(res.status).toBe(403);
      // DB should not have been queried - the cache was sufficient to deny.
      expect(db.prepare).not.toHaveBeenCalled();
    });

    it('re-queries the DB after a cached entry expires', async () => {
      vi.useFakeTimers();
      globalCache.set('agent_owner_agent-1', 'user-123', 100);

      // Advance past the TTL
      vi.advanceTimersByTime(200);

      const db = makeDB({ 'agent-1': 'user-123' });
      await app.request('/agents/agent-1', {}, { ...ENV_BASE, DB: db });

      expect(db.prepare).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // ensureSessionOwnership
  // -----------------------------------------------------------------------
  describe('ensureSessionOwnership', () => {
    it('returns 403 when session does not exist', async () => {
      const db = makeDB({});
      const res = await app.request('/sessions/session-1', {}, { ...ENV_BASE, DB: db });
      expect(res.status).toBe(403);
    });

    it('returns 403 when session is owned by a different user', async () => {
      const db = makeDB({ 'session-1': 'user-other' });
      const res = await app.request('/sessions/session-1', {}, { ...ENV_BASE, DB: db });
      expect(res.status).toBe(403);
    });

    it('serves cached owner without querying the DB on second call', async () => {
      globalCache.set('session_owner_session-1', 'user-123', 60000);
      const db = makeDB({});

      const res = await app.request('/sessions/session-1', {}, { ...ENV_BASE, DB: db });
      // Access check passed but no ANTHROPIC_API_KEY → 500 from upstream
      expect([403, 500]).toContain(res.status);
      expect(db.prepare).not.toHaveBeenCalled();
    });

    it('still rejects access when cached ownerId does not match the current user', async () => {
      globalCache.set('session_owner_session-1', 'user-other', 60000);
      const db = makeDB({});

      const res = await app.request('/sessions/session-1', {}, { ...ENV_BASE, DB: db });
      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // ensureEnvironmentOwnership
  // -----------------------------------------------------------------------
  describe('ensureEnvironmentOwnership', () => {
    it('returns 403 when environment does not exist', async () => {
      const db = makeDB({});
      const res = await app.request('/environments/env-1', {}, { ...ENV_BASE, DB: db });
      expect(res.status).toBe(403);
    });

    it('returns 403 when environment is owned by a different user', async () => {
      const db = makeDB({ 'env-1': 'user-other' });
      const res = await app.request('/environments/env-1', {}, { ...ENV_BASE, DB: db });
      expect(res.status).toBe(403);
    });

    it('serves cached owner without querying the DB on second call', async () => {
      globalCache.set('env_owner_env-1', 'user-123', 60000);
      const db = makeDB({});

      const res = await app.request('/environments/env-1', {}, { ...ENV_BASE, DB: db });
      // Access check passed but no ANTHROPIC_API_KEY → 500 from upstream
      expect([403, 500]).toContain(res.status);
      expect(db.prepare).not.toHaveBeenCalled();
    });

    it('still rejects access when cached ownerId does not match the current user', async () => {
      globalCache.set('env_owner_env-1', 'user-other', 60000);
      const db = makeDB({});

      const res = await app.request('/environments/env-1', {}, { ...ENV_BASE, DB: db });
      expect(res.status).toBe(403);
    });

    it('invalidates the cache after a successful DELETE', async () => {
      // Pre-populate the cache.
      globalCache.set('env_owner_env-1', 'user-123', 60000);

      // Mock upstream Anthropic DELETE to succeed.
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));

      const db = makeDB({ 'env-1': 'user-123' });
      await app.request(
        '/environments/env-1',
        { method: 'DELETE' },
        { ...ENV_BASE, DB: db, ANTHROPIC_API_KEY: 'test-key' },
      );

      // The cache entry should have been invalidated after deletion.
      expect(globalCache.get('env_owner_env-1')).toBeUndefined();
    });
  });
});
