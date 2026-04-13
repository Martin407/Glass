import { describe, it, expect, vi, afterEach } from 'vitest';
import { TTLMemoryCache } from '../index.js';

describe('TTLMemoryCache', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('get', () => {
    it('returns undefined for a missing key', () => {
      const cache = new TTLMemoryCache();
      expect(cache.get('missing')).toBeUndefined();
    });

    it('returns the value for a key that has not expired', () => {
      const cache = new TTLMemoryCache();
      cache.set('key', 'value', 60000);
      expect(cache.get('key')).toBe('value');
    });

    it('returns undefined and evicts an entry whose TTL has elapsed', () => {
      vi.useFakeTimers();
      const cache = new TTLMemoryCache();
      cache.set('key', 'value', 1000);

      vi.advanceTimersByTime(1001);

      expect(cache.get('key')).toBeUndefined();
    });
  });

  describe('set', () => {
    it('stores a value and retrieves it before expiry', () => {
      const cache = new TTLMemoryCache();
      cache.set('k', 'v', 5000);
      expect(cache.get('k')).toBe('v');
    });

    it('overwrites an existing key with a new value', () => {
      const cache = new TTLMemoryCache();
      cache.set('k', 'old', 5000);
      cache.set('k', 'new', 5000);
      expect(cache.get('k')).toBe('new');
    });

    it('evicts an expired entry when at maxSize before inserting a new one', () => {
      vi.useFakeTimers();
      const cache = new TTLMemoryCache(2);
      cache.set('a', '1', 500);
      cache.set('b', '2', 60000);

      // Expire entry 'a'
      vi.advanceTimersByTime(501);

      cache.set('c', '3', 60000);

      // 'a' was expired and should have been evicted
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe('2');
      expect(cache.get('c')).toBe('3');
    });

    it('evicts the oldest inserted entry (LRU fallback) when no expired entries exist and cache is full', () => {
      const cache = new TTLMemoryCache(2);
      cache.set('first', '1', 60000);
      cache.set('second', '2', 60000);
      cache.set('third', '3', 60000); // triggers eviction of 'first'

      expect(cache.get('first')).toBeUndefined();
      expect(cache.get('second')).toBe('2');
      expect(cache.get('third')).toBe('3');
    });
  });

  describe('delete', () => {
    it('removes a key from the cache', () => {
      const cache = new TTLMemoryCache();
      cache.set('key', 'value', 60000);
      cache.delete('key');
      expect(cache.get('key')).toBeUndefined();
    });

    it('is a no-op for keys that do not exist', () => {
      const cache = new TTLMemoryCache();
      expect(() => cache.delete('nonexistent')).not.toThrow();
    });
  });
});
