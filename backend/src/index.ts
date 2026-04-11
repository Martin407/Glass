import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import Anthropic from '@anthropic-ai/sdk'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { RealtimeStateObject } from './durable-object'

type Bindings = {
  DB: D1Database
  REALTIME_STATE: DurableObjectNamespace
  ANTHROPIC_API_KEY?: string
  OKTA_CLIENT_ID?: string
  OKTA_CLIENT_SECRET?: string
  OKTA_DOMAIN?: string
}

type Variables = {
  user: { id: string }
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

let cachedJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;
let lastOktaDomain: string | null = null;

// Auth Middleware
app.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.split(' ')[1]

  try {
    const oktaDomain = c.env.OKTA_DOMAIN;
    if (!oktaDomain) {
      console.error('OKTA_DOMAIN environment variable is missing.');
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const normalizedOktaDomain = oktaDomain.replace(/\/$/, '');

    const audience = c.env.OKTA_CLIENT_ID || 'api://default';

    // Initialize or re-initialize if domain changes
    if (!cachedJWKS || lastOktaDomain !== normalizedOktaDomain) {
      const jwksUri = new URL(`${normalizedOktaDomain}/oauth2/default/v1/keys`);
      cachedJWKS = createRemoteJWKSet(jwksUri);
      lastOktaDomain = normalizedOktaDomain;
    }

    const { payload } = await jwtVerify(token, cachedJWKS, {
      issuer: `${normalizedOktaDomain}/oauth2/default`,
      audience: audience,
    });

    if (payload.sub) {
      c.set('user', { id: payload.sub });
    } else {
      return c.json({ error: 'Unauthorized - Invalid Token Payload' }, 401)
    }

    await next()
  } catch (error) {
    console.error('JWT verification failed:', error);
    return c.json({ error: 'Unauthorized' }, 401)
  }
})

const getAnthropicHeaders = (c: any) => ({
  'Content-Type': 'application/json',
  'anthropic-version': '2023-06-01',
  'anthropic-beta': 'managed-agents-2026-04-01',
  'X-Api-Key': c.env.ANTHROPIC_API_KEY || 'dummy',
  'x-okta-user-id': c.get('user')?.id
})

const fetchAnthropic = async (c: any, endpoint: string, options: RequestInit = {}) => {
  try {
    const response = await fetch(`https://api.anthropic.com/v1${endpoint}`, {
      ...options,
      headers: {
        ...getAnthropicHeaders(c),
        ...options.headers,
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as any;
      return c.json({ error: errorData.error?.message || `Anthropic API Error: ${response.status} ${response.statusText}` }, response.status as any);
    }

    // For DELETE operations, response might be empty or specific JSON
    const data = await response.json().catch(() => ({}));
    return c.json(data);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}
app.get('/', (c) => {
  return c.text('Multiplayer Managed Agents Platform API')
})

// ----- Agents Endpoints -----
app.post('/agents', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    return fetchAnthropic(c, '/agents', { method: 'POST', body: JSON.stringify(body) })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

app.get('/agents', async (c) => {
  return fetchAnthropic(c, '/agents')
})

app.get('/agents/:agent_id', async (c) => {
  return fetchAnthropic(c, `/agents/${c.req.param('agent_id')}`)
})

app.post('/agents/:agent_id', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    return fetchAnthropic(c, `/agents/${c.req.param('agent_id')}`, { method: 'POST', body: JSON.stringify(body) })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

app.post('/agents/:agent_id/archive', async (c) => {
  return fetchAnthropic(c, `/agents/${c.req.param('agent_id')}/archive`, { method: 'POST' })
})

app.get('/agents/:agent_id/versions', async (c) => {
  return fetchAnthropic(c, `/agents/${c.req.param('agent_id')}/versions`)
})

// ----- Sessions Endpoints -----
app.post('/sessions', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    return fetchAnthropic(c, '/sessions', { method: 'POST', body: JSON.stringify(body) })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

app.get('/sessions', async (c) => {
  return fetchAnthropic(c, '/sessions')
})

app.get('/sessions/:session_id', async (c) => {
  return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}`)
})

app.post('/sessions/:session_id', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}`, { method: 'POST', body: JSON.stringify(body) })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

app.delete('/sessions/:session_id', async (c) => {
  return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}`, { method: 'DELETE' })
})

app.post('/sessions/:session_id/archive', async (c) => {
  return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}/archive`, { method: 'POST' })
})

// ----- Session Events Endpoints -----
app.get('/sessions/:session_id/events', async (c) => {
  return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}/events`)
})

app.post('/sessions/:session_id/events', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}/events`, { method: 'POST', body: JSON.stringify(body) })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

app.get('/sessions/:session_id/events/stream', async (c) => {
  return streamSSE(c, async (stream) => {
    try {
      const response = await fetch(`https://api.anthropic.com/v1/sessions/${c.req.param('session_id')}/events/stream`, {
        headers: getAnthropicHeaders(c)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any;
        await stream.writeSSE({
          data: JSON.stringify({ error: errorData.error?.message || `Error: ${response.status}` }),
          event: 'error'
        })
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder('utf-8');
      let buffer = '';

let currentEvent = 'message';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue;
            try {
              // Write raw stream data directly to our client
              await stream.writeSSE({
                data: dataStr,
                event: currentEvent,
                id: String(Date.now())
              });
            } catch (e) {
              // ignore parse errors for partial chunks
            }
          }
        }
      }
    } catch (err: any) {
      await stream.writeSSE({
        data: JSON.stringify({ error: err.message }),
        event: 'error',
      })
    }
  })
})

// ----- Session Resources Endpoints -----
app.post('/sessions/:session_id/resources', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}/resources`, { method: 'POST', body: JSON.stringify(body) })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

app.get('/sessions/:session_id/resources', async (c) => {
  return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}/resources`)
})

app.get('/sessions/:session_id/resources/:resource_id', async (c) => {
  return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}/resources/${c.req.param('resource_id')}`)
})

app.post('/sessions/:session_id/resources/:resource_id', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}/resources/${c.req.param('resource_id')}`, { method: 'POST', body: JSON.stringify(body) })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

app.delete('/sessions/:session_id/resources/:resource_id', async (c) => {
  return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}/resources/${c.req.param('resource_id')}`, { method: 'DELETE' })
})

// ----- Environments Endpoints -----
app.post('/environments', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    return fetchAnthropic(c, '/environments', { method: 'POST', body: JSON.stringify(body) })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

app.get('/environments', async (c) => {
  return fetchAnthropic(c, '/environments')
})

app.get('/environments/:environment_id', async (c) => {
  return fetchAnthropic(c, `/environments/${c.req.param('environment_id')}`)
})

app.post('/environments/:environment_id', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    return fetchAnthropic(c, `/environments/${c.req.param('environment_id')}`, { method: 'POST', body: JSON.stringify(body) })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

app.delete('/environments/:environment_id', async (c) => {
  return fetchAnthropic(c, `/environments/${c.req.param('environment_id')}`, { method: 'DELETE' })
})

app.post('/environments/:environment_id/archive', async (c) => {
  return fetchAnthropic(c, `/environments/${c.req.param('environment_id')}/archive`, { method: 'POST' })
})


export { RealtimeStateObject }

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    console.log('Cron trigger executed at', event.cron)
  }
}
