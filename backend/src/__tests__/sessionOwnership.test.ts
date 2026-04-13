import { describe, it, expect, vi } from 'vitest';
import { TTLMemoryCache, ensureSessionOwnership } from '../index';
import type { AppContext } from '../index.js';

// Builds a minimal mock AppContext for testing ensureSessionOwnership.
function makeCtx(userId: string, dbResult: { user_id: string } | null, cacheInstance = new TTLMemoryCache()) {
  const prepareMock = vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnValue({
      first: vi.fn().mockResolvedValue(dbResult),
    }),
  });
  return {
    get: (key: string) => {
      if (key === 'user') return { id: userId };
      if (key === 'cache') return cacheInstance;
    },
    env: { DB: { prepare: prepareMock } },
    json: vi.fn(),
    prepareMock,
  } as unknown as AppContext & { prepareMock: ReturnType<typeof vi.fn> };
}

describe('TTLMemoryCache', () => {
  it('returns undefined for missing keys', () => {
    const cache = new TTLMemoryCache(3);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('stores and retrieves values', () => {
    const cache = new TTLMemoryCache(3);
    cache.set('key', 'value', 60000);
    expect(cache.get('key')).toBe('value');
  });

  it('evicts the least-recently-used entry when maxSize is exceeded', () => {
    const cache = new TTLMemoryCache(2);
    cache.set('a', '1', 60000);
    cache.set('b', '2', 60000);
    // 'a' is LRU; adding 'c' should evict 'a'
    cache.set('c', '3', 60000);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('2');
    expect(cache.get('c')).toBe('3');
  });



  it('overwrites an existing key without changing the cache size', () => {
    const cache = new TTLMemoryCache(2);
    cache.set('a', '1', 60000);
    cache.set('a', '2', 60000);
    expect(cache.get('a')).toBe('2');
    // Only one entry should exist; adding 'b' should not evict anything
    cache.set('b', '3', 60000);
    expect(cache.get('a')).toBe('2');
    expect(cache.get('b')).toBe('3');
  });
});

describe('ensureSessionOwnership', () => {
  it('returns undefined (authorized) when the user owns the session', async () => {
    const ctx = makeCtx('user-1', { user_id: 'user-1' });
    const result = await ensureSessionOwnership(ctx, 'sess-auth-1');
    expect(result).toBeUndefined();
  });

  it('returns a 403 response when the session belongs to a different user', async () => {
    const ctx = makeCtx('user-2', { user_id: 'user-1' });
    await ensureSessionOwnership(ctx, 'sess-auth-2');
    expect((ctx as unknown as { json: ReturnType<typeof vi.fn> }).json).toHaveBeenCalledWith(
      { error: 'Session not found or unauthorized' },
      403,
    );
  });

  it('returns a 403 response when the session does not exist in the DB', async () => {
    const ctx = makeCtx('user-3', null);
    await ensureSessionOwnership(ctx, 'sess-auth-3');
    expect((ctx as unknown as { json: ReturnType<typeof vi.fn> }).json).toHaveBeenCalledWith(
      { error: 'Session not found or unauthorized' },
      403,
    );
  });

  it('queries the DB only on the first lookup; subsequent calls use the cache', async () => {
    // Use a unique session ID to avoid interference from the module-level cache
    const sessionId = `sess-cache-${Math.random()}`;
    const ctx = makeCtx('user-4', { user_id: 'user-4' });
    const { prepareMock } = ctx as unknown as { prepareMock: ReturnType<typeof vi.fn> };

    // First call — should hit the DB
    await ensureSessionOwnership(ctx, sessionId);
    expect(prepareMock).toHaveBeenCalledTimes(1);

    // Second call — should be served from cache, no additional DB query
    await ensureSessionOwnership(ctx, sessionId);
    expect(prepareMock).toHaveBeenCalledTimes(1);
  });
});
