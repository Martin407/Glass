import { bench, describe } from 'vitest';

const n = 1000;
const m = 1000;

const prev = Array.from({ length: n }, (_, i) => ({ name: `App${i}` }));
const connections = Array.from({ length: m }, (_, i) => `App${i * 2}`);

describe('App connections optimization', () => {
  bench('baseline: includes', () => {
    return prev.map(app => ({
      ...app,
      connected: connections.includes(app.name)
    })) as unknown as void;
  });

  bench('optimized: Set', () => {
    const connectionsSet = new Set(connections);
    return prev.map(app => ({
      ...app,
      connected: connectionsSet.has(app.name)
    })) as unknown as void;
  });
});
