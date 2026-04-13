import { bench, describe } from 'vitest';

const mockData = {
  data: Array.from({ length: 100 }, (_, i) => ({ id: `env-${i}` }))
};

describe('response cloning', () => {
  bench('with clone', async () => {
    const response = new Response(JSON.stringify(mockData));
    const data = await response.clone().json();
    if (Array.isArray(data?.data)) {
       data.data = data.data.filter((e: any) => e.id);
    }
    return data;
  });

  bench('without clone', async () => {
    const response = new Response(JSON.stringify(mockData));
    const data = await response.json();
    if (Array.isArray(data?.data)) {
       data.data = data.data.filter((e: any) => e.id);
    }
    return data;
  });
});
