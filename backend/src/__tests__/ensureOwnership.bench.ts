import { bench, describe } from 'vitest';
import { TTLMemoryCache } from '../index.js';

/**
 * Simulated D1 query latency (ms). Typical Cloudflare D1 round-trip is
 * ~10–30 ms; we use 20 ms here as a conservative baseline.
 */
const SIMULATED_DB_LATENCY_MS = 20;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

describe('ensureOwnership cache vs. DB', () => {
  const cache = new TTLMemoryCache();
  const AGENT_ID = 'bench-agent-1';
  const OWNER_ID = 'user-bench';

  bench('cache miss – simulates D1 query latency (~20 ms)', async () => {
    cache.delete(`agent_owner_${AGENT_ID}`);
    await sleep(SIMULATED_DB_LATENCY_MS);
    cache.set(`agent_owner_${AGENT_ID}`, OWNER_ID, 60000);
  });

  bench('cache hit – no DB query, sub-millisecond', () => {
    cache.set(`agent_owner_${AGENT_ID}`, OWNER_ID, 60000);
    cache.get(`agent_owner_${AGENT_ID}`);
  });
});
