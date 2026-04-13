import { Context, Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

const getErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);
import { RealtimeStateObject } from './durable-object'
import { Anthropic } from '@anthropic-ai/sdk'
import { jwtVerify, createRemoteJWKSet } from 'jose'

export type Bindings = {
  DB: D1Database
  REALTIME_STATE: DurableObjectNamespace
  ANTHROPIC_API_KEY?: string
  OKTA_CLIENT_ID?: string
  OKTA_CLIENT_SECRET?: string
  OKTA_DOMAIN?: string
  OKTA_ISSUER?: string
  OKTA_AUDIENCE?: string
  AUTH_BYPASS_FOR_DEV?: string
}

type Variables = {
  user: { id: string; roles?: string[] }
}

export type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>

export const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let jwksIssuer: string | undefined;
// SQLite SQLITE_CONSTRAINT error code.
const SQLITE_CONSTRAINT_ERROR_CODE = '19';

export const normalizeOktaDomain = (domain: string): string => {
  const trimmedDomain = domain.trim();
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedDomain.includes('://') ? trimmedDomain : `https://${trimmedDomain}`);
  } catch {
    throw new Error('OKTA_DOMAIN must be a valid domain or URL');
  }
  if (parsedUrl.pathname !== '/' || parsedUrl.search || parsedUrl.hash) {
    throw new Error('OKTA_DOMAIN must not include a path, query, or fragment');
  }
  return parsedUrl.host;
};

export const normalizeIssuer = (configuredIssuer: string): string => {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(configuredIssuer.trim());
  } catch {
    throw new Error('OKTA_ISSUER must be a valid URL');
  }
  if (parsedUrl.search || parsedUrl.hash) {
    throw new Error('OKTA_ISSUER must not include a query or fragment');
  }
  parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, '');
  return parsedUrl.toString();
};

export const getOktaIssuer = (domain: string, configuredIssuer?: string) => {
  if (configuredIssuer) {
    return normalizeIssuer(configuredIssuer);
  }
  return `https://${normalizeOktaDomain(domain)}/oauth2/default`;
};

const getOktaAudience = (configuredAudience?: string, clientId?: string) =>
  configuredAudience ?? clientId;

const getUser = (c: AppContext): { id: string } => c.get('user');

export const isConstraintError = (error: unknown): boolean => {
  const candidate = error as { code?: string | number; message?: string; cause?: unknown };
  const cause = candidate?.cause as { code?: string | number } | undefined;
  const codes = [candidate?.code, cause?.code].map((value) => String(value ?? '').toUpperCase());
  return codes.includes(SQLITE_CONSTRAINT_ERROR_CODE) || codes.some((code) => code.startsWith('SQLITE_CONSTRAINT'));
};

export class LRUCache<K, V> {
  private maxSize: number;
  private cache: Map<K, V>;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
    this.cache = new Map<K, V>();
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const val = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }
}

export const sessionOwnershipCache = new LRUCache<string, string>(1000);

const ensureAgentOwnership = async (c: AppContext, agentId: string): Promise<Response | undefined> => {
  const user = getUser(c);
  const owner = await c.env.DB.prepare('SELECT user_id FROM agents WHERE id = ?')
    .bind(agentId)
    .first<{ user_id: string }>();

  if (!owner || owner.user_id !== user.id) {
    return c.json({ error: 'Agent not found or unauthorized' }, 403);
  }
};

export const ensureSessionOwnership = async (c: AppContext, sessionId: string): Promise<Response | undefined> => {
  const user = getUser(c);

  let ownerUserId = sessionOwnershipCache.get(sessionId);

  if (ownerUserId === undefined) {
    const owner = await c.env.DB.prepare('SELECT user_id FROM sessions WHERE id = ?')
      .bind(sessionId)
      .first<{ user_id: string }>();

    if (owner) {
      ownerUserId = owner.user_id;
      sessionOwnershipCache.set(sessionId, ownerUserId);
    }
  }

  if (ownerUserId === undefined || ownerUserId !== user.id) {
    return c.json({ error: 'Session not found or unauthorized' }, 403);
  }
};

const ensureEnvironmentOwnership = async (c: AppContext, environmentId: string): Promise<Response | undefined> => {
  const user = getUser(c);
  const owner = await c.env.DB.prepare('SELECT user_id FROM environments WHERE id = ?')
    .bind(environmentId)
    .first<{ user_id: string }>();

  if (!owner || owner.user_id !== user.id) {
    return c.json({ error: 'Environment not found or unauthorized' }, 403);
  }
};

const archiveUpstreamResource = async (
  c: AppContext,
  resourceType: 'agents' | 'sessions' | 'environments',
  resourceId: string,
  errorContext: string
) => {
  try {
    const archiveResponse = await fetch(`https://api.anthropic.com/v1/${resourceType}/${resourceId}/archive`, {
      method: 'POST',
      headers: getAnthropicHeaders(c)
    });
    if (!archiveResponse.ok) {
      const archiveErrorData: unknown = await archiveResponse.json().catch(() => 'Unable to parse upstream archive error response');
      console.error(`${errorContext}: upstream archive failed with ${archiveResponse.status}`, archiveErrorData);
    }
  } catch (archiveError) {
    console.error(`${errorContext}: upstream archive request failed`, archiveError);
  }
};

// Auth Middleware
app.use('*', async (c, next) => {
  if (!c.env.OKTA_DOMAIN) {
    if (c.env.AUTH_BYPASS_FOR_DEV === 'true') {
      c.set('user', { id: 'user-123', roles: ['admin'] });
      return await next();
    }
    console.error('Authentication is misconfigured: OKTA_DOMAIN is required');
    return c.json({ error: 'Authentication is misconfigured' }, 500);
  }

  let issuer: string;
  try {
    issuer = getOktaIssuer(c.env.OKTA_DOMAIN, c.env.OKTA_ISSUER);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Invalid OKTA auth configuration';
    console.error(`Authentication is misconfigured: ${message}`, error);
    return c.json({ error: 'Authentication is misconfigured' }, 500);
  }
  const audience = getOktaAudience(c.env.OKTA_AUDIENCE, c.env.OKTA_CLIENT_ID);
  if (!audience) {
    console.error('Authentication is misconfigured: OKTA_AUDIENCE or OKTA_CLIENT_ID is required');
    return c.json({ error: 'Authentication is misconfigured' }, 500);
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.split(' ')[1];

  if (!jwks || jwksIssuer !== issuer) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/v1/keys`));
    jwksIssuer = issuer;
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience,
      algorithms: ['RS256']
    });
    if (!payload.sub) {
      return c.json({ error: 'Invalid token: missing sub claim' }, 401);
    }
    const rawRoles = payload.groups ?? payload.roles;
    const roles: string[] = Array.isArray(rawRoles)
      ? rawRoles.filter((r): r is string => typeof r === 'string')
      : [];
    c.set('user', { id: payload.sub, roles });
    return await next();
  } catch (error: unknown) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
})

export const parseAnthropicError = async (response: Response): Promise<string> => {
  const errorData = await response.json().catch(() => ({})) as any;
  return errorData.error?.message || `Anthropic API Error: ${response.status} ${response.statusText}`;
};

export const handleAnthropicError = async (c: AppContext, response: Response) => {
  const errorMessage = await parseAnthropicError(response);
  return c.json({ error: errorMessage }, response.status as any);
};

const getAnthropicHeaders = (c: AppContext) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'managed-agents-2026-04-01',
  }
  if (c.env.ANTHROPIC_API_KEY) {
    headers['X-Api-Key'] = c.env.ANTHROPIC_API_KEY
  }
  const user = c.get('user')
  if (user && user.id) {
    headers['x-okta-user-id'] = user.id
  }
  return headers
}

const fetchAnthropic = async (c: AppContext, endpoint: string, options: RequestInit = {}) => {
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }
  try {
    const response = await fetch(`https://api.anthropic.com/v1${endpoint}`, {
      ...options,
      headers: {
        ...getAnthropicHeaders(c),
        ...options.headers,
      }
    })

    if (!response.ok) {
      return handleAnthropicError(c, response);
    }

    // For DELETE operations, response might be empty or specific JSON
    const data = await response.json().catch(() => ({}));
    return c.json(data);
  } catch (error: unknown) {
    return c.json({ error: getErrorMessage(error) }, 500)
  }
}

app.get('/', (c) => {
  return c.text('Multiplayer Managed Agents Platform API')
})

// ----- Agents Endpoints -----
app.post('/agents', async (c) => {
  try {
    if (!c.env.ANTHROPIC_API_KEY) {
      return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
    }
    const user = getUser(c);
    const body = await c.req.json().catch(() => ({}))
    const response = await fetch(`https://api.anthropic.com/v1/agents`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: getAnthropicHeaders(c)
    });

    if (!response.ok) {
      return handleAnthropicError(c, response);
    }

    const data: any = await response.json();
    if (data.id) {
      try {
        await c.env.DB.prepare('INSERT INTO agents (id, user_id) VALUES (?, ?)')
          .bind(data.id, user.id)
          .run();
      } catch (err: unknown) {
        await archiveUpstreamResource(c, 'agents', data.id, 'Failed to persist local agent ownership after upstream create');
        if (isConstraintError(err)) {
          return c.json({ error: 'Agent already exists' }, 409);
        }
        console.error('Failed to store local agent ownership after creating agent', err);
        return c.json({ error: 'Failed to store local agent ownership after creating agent' }, 500);
      }
    }

    return c.json(data);
  } catch (err: unknown) {
    return c.json({ error: getErrorMessage(err) }, 500)
  }
})

app.get('/agents', async (c) => {
  try {
    if (!c.env.ANTHROPIC_API_KEY) {
      return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
    }
    const user = getUser(c);
    const { results } = await c.env.DB.prepare('SELECT id FROM agents WHERE user_id = ?')
      .bind(user.id)
      .all<{ id: string }>();
    const ownedAgentIds = new Set(results.map((row: { id: string }) => row.id));
    if (ownedAgentIds.size === 0) {
      return c.json({ data: [] });
    }

    const response = await fetch(`https://api.anthropic.com/v1/agents`, {
      headers: getAnthropicHeaders(c)
    });

    if (!response.ok) {
      return handleAnthropicError(c, response);
    }

    const data: any = await response.json();
    if (Array.isArray(data?.data)) {
      data.data = data.data.filter((agent: { id?: string }) => agent.id && ownedAgentIds.has(agent.id));
    } else {
      data.data = [];
    }
    return c.json(data);
  } catch (err: unknown) {
    return c.json({ error: getErrorMessage(err) }, 500)
  }
})

app.get('/agents/:agent_id', async (c) => {
  const ownershipError = await ensureAgentOwnership(c, c.req.param('agent_id'));
  if (ownershipError) return ownershipError;
  return fetchAnthropic(c, `/agents/${c.req.param('agent_id')}`)
})

app.post('/agents/:agent_id', async (c) => {
  try {
    const ownershipError = await ensureAgentOwnership(c, c.req.param('agent_id'));
    if (ownershipError) return ownershipError;
    const body = await c.req.json().catch(() => ({}))
    return fetchAnthropic(c, `/agents/${c.req.param('agent_id')}`, { method: 'POST', body: JSON.stringify(body) })
  } catch (err: unknown) {
    return c.json({ error: getErrorMessage(err) }, 500)
  }
})

app.post('/agents/:agent_id/archive', async (c) => {
  const ownershipError = await ensureAgentOwnership(c, c.req.param('agent_id'));
  if (ownershipError) return ownershipError;
  return fetchAnthropic(c, `/agents/${c.req.param('agent_id')}/archive`, { method: 'POST' })
})

app.get('/agents/:agent_id/versions', async (c) => {
  const ownershipError = await ensureAgentOwnership(c, c.req.param('agent_id'));
  if (ownershipError) return ownershipError;
  return fetchAnthropic(c, `/agents/${c.req.param('agent_id')}/versions`)
})

// ----- Sessions Endpoints -----
app.post('/sessions', async (c) => {
  try {
    if (!c.env.ANTHROPIC_API_KEY) {
      return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500)
    }
    const user = getUser(c)
    const body = await c.req.json().catch(() => ({}))
    const agentId = typeof body?.agent_id === 'string' ? body.agent_id : undefined;
    if (!agentId) {
      return c.json({ error: 'agent_id is required' }, 400);
    }
    const ownershipError = await ensureAgentOwnership(c, agentId);
    if (ownershipError) return ownershipError;

    // Create session in Anthropic
    const response = await fetch(`https://api.anthropic.com/v1/sessions`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: getAnthropicHeaders(c)
    })

    if (!response.ok) {
      return handleAnthropicError(c, response);
    }

    const data: any = await response.json();

    // Store mapping in D1
    if (data.id) {
      try {
        await c.env.DB.prepare('INSERT INTO sessions (id, user_id) VALUES (?, ?)')
          .bind(data.id, user.id)
          .run()
      } catch (err: unknown) {
        await archiveUpstreamResource(c, 'sessions', data.id, 'Failed to persist local session ownership after upstream create');
        if (isConstraintError(err)) {
          return c.json({ error: 'Failed to store session mapping due to a session ID conflict.' }, 409);
        }
        console.error('Failed to store local session ownership after creating session', err);
        return c.json({ error: 'Failed to store local session ownership after creating session' }, 500);
      }
    }

    return c.json(data)
  } catch (err: unknown) {
    return c.json({ error: getErrorMessage(err) }, 500)
  }
})

app.get('/sessions', async (c) => {
  try {
    const user = c.get('user')
    const { results } = await c.env.DB.prepare('SELECT id, created_at FROM sessions WHERE user_id = ?')
      .bind(user.id)
      .all()
    return c.json({ data: results })
  } catch (err: unknown) {
    return c.json({ error: getErrorMessage(err) }, 500)
  }
})

app.get('/sessions/:session_id', async (c) => {
  const ownershipError = await ensureSessionOwnership(c, c.req.param('session_id'));
  if (ownershipError) return ownershipError;
  return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}`)
})

app.post('/sessions/:session_id', async (c) => {
  try {
    const ownershipError = await ensureSessionOwnership(c, c.req.param('session_id'));
    if (ownershipError) return ownershipError;
    const body = await c.req.json().catch(() => ({}))
    return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}`, { method: 'POST', body: JSON.stringify(body) })
  } catch (err: unknown) {
    return c.json({ error: getErrorMessage(err) }, 500)
  }
})

app.delete('/sessions/:session_id', async (c) => {
  const ownershipError = await ensureSessionOwnership(c, c.req.param('session_id'));
  if (ownershipError) return ownershipError;
  return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}`, { method: 'DELETE' })
})

app.post('/sessions/:session_id/archive', async (c) => {
  const ownershipError = await ensureSessionOwnership(c, c.req.param('session_id'));
  if (ownershipError) return ownershipError;
  return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}/archive`, { method: 'POST' })
})

// ----- Session Events Endpoints -----

app.post('/sessions/:session_id/run', async (c) => {
  try {
    const sessionId = c.req.param('session_id')
    const { message } = await c.req.json().catch(() => ({}))
    const user = getUser(c);

    if (!c.env.ANTHROPIC_API_KEY) {
      return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
    }

    const ownershipError = await ensureSessionOwnership(c, sessionId);
    if (ownershipError) return ownershipError;

    // Prepare events array
    const events: any[] = [];
    if (message) {
      events.push({
        type: 'user.message' as const,
        content: [
          { type: 'text' as const, text: message }
        ]
      });
    }

    const client = new Anthropic({
      apiKey: c.env.ANTHROPIC_API_KEY,
      defaultHeaders: { 'x-okta-user-id': user.id }
    });

    // Establish the stream first to avoid race conditions
    const sessionStream = await client.beta.sessions.events.stream(sessionId);

    return streamSSE(c, async (stream) => {
      if (events.length > 0) {
        // Send events asynchronously without awaiting so the stream can start processing them immediately.
        // Use void to explicitly discard the returned Promise (fire-and-forget with handled rejection).
        void client.beta.sessions.events.send(sessionId, { events }).catch((err: unknown) => {
          console.error('Error sending events to stream:', err);
          // Abort the session stream so the for-await loop below terminates instead of hanging.
          sessionStream.controller.abort();
          stream.writeSSE({
            data: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
            event: 'error',
          }).catch(() => {
            // Ignore stream write errors if connection already closed
          });
        });
      }

      try {
        for await (const event of sessionStream) {
          await stream.writeSSE({
            data: JSON.stringify(event),
            event: 'message',
            id: String(Date.now())
          });
        }
      } catch (err: unknown) {
        // If the stream was intentionally aborted (due to events.send failure above),
        // skip writing a duplicate/misleading error event — the catch above already sent one.
        if (!sessionStream.controller.signal.aborted) {
          await stream.writeSSE({
            data: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
            event: 'error',
          });
        }
      }
    })
  } catch (err: unknown) {
    return c.json({ error: getErrorMessage(err) }, 500)
  }
})

app.get('/sessions/:session_id/events', async (c) => {
  const ownershipError = await ensureSessionOwnership(c, c.req.param('session_id'));
  if (ownershipError) return ownershipError;
  return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}/events`)
})

app.post('/sessions/:session_id/events', async (c) => {
  try {
    const ownershipError = await ensureSessionOwnership(c, c.req.param('session_id'));
    if (ownershipError) return ownershipError;
    const body = await c.req.json().catch(() => ({}))
    return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}/events`, { method: 'POST', body: JSON.stringify(body) })
  } catch (err: unknown) {
    return c.json({ error: getErrorMessage(err) }, 500)
  }
})

app.get('/sessions/:session_id/events/stream', async (c) => {
  const ownershipError = await ensureSessionOwnership(c, c.req.param('session_id'));
  if (ownershipError) return ownershipError;
  return streamSSE(c, async (stream) => {
    try {
      const response = await fetch(`https://api.anthropic.com/v1/sessions/${c.req.param('session_id')}/events/stream`, {
        headers: getAnthropicHeaders(c)
      })

      if (!response.ok) {
        const errorMessage = await parseAnthropicError(response);
        await stream.writeSSE({
          data: JSON.stringify({ error: errorMessage }),
          event: 'error'
        });
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue;
            try {
              // Write raw stream data directly to our client
              await stream.writeSSE({
                data: dataStr,
                event: 'message',
                id: String(Date.now())
              });
            } catch {
              // ignore parse errors for partial chunks
            }
          }
        }
      }
    } catch (err: unknown) {
      await stream.writeSSE({
        data: JSON.stringify({ error: getErrorMessage(err) }),
        event: 'error',
      })
    }
  })
})

// ----- Session Resources Endpoints -----
app.post('/sessions/:session_id/resources', async (c) => {
  try {
    const ownershipError = await ensureSessionOwnership(c, c.req.param('session_id'));
    if (ownershipError) return ownershipError;
    const body = await c.req.json().catch(() => ({}))
    return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}/resources`, { method: 'POST', body: JSON.stringify(body) })
  } catch (err: unknown) {
    return c.json({ error: getErrorMessage(err) }, 500)
  }
})

app.get('/sessions/:session_id/resources', async (c) => {
  const ownershipError = await ensureSessionOwnership(c, c.req.param('session_id'));
  if (ownershipError) return ownershipError;
  return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}/resources`)
})

app.get('/sessions/:session_id/resources/:resource_id', async (c) => {
  const ownershipError = await ensureSessionOwnership(c, c.req.param('session_id'));
  if (ownershipError) return ownershipError;
  return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}/resources/${c.req.param('resource_id')}`)
})

app.post('/sessions/:session_id/resources/:resource_id', async (c) => {
  try {
    const ownershipError = await ensureSessionOwnership(c, c.req.param('session_id'));
    if (ownershipError) return ownershipError;
    const body = await c.req.json().catch(() => ({}))
    return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}/resources/${c.req.param('resource_id')}`, { method: 'POST', body: JSON.stringify(body) })
  } catch (err: unknown) {
    return c.json({ error: getErrorMessage(err) }, 500)
  }
})

app.delete('/sessions/:session_id/resources/:resource_id', async (c) => {
  const ownershipError = await ensureSessionOwnership(c, c.req.param('session_id'));
  if (ownershipError) return ownershipError;
  return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}/resources/${c.req.param('resource_id')}`, { method: 'DELETE' })
})

// ----- Environments Endpoints -----
app.post('/environments', async (c) => {
  try {
    if (!c.env.ANTHROPIC_API_KEY) {
      return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
    }
    const user = getUser(c);
    const body = await c.req.json().catch(() => ({}))

    const response = await fetchAnthropic(c, '/environments', { method: 'POST', body: JSON.stringify(body) });

    if (!response.ok) {
      return response;
    }

    // Clone the response so we can read it and still return it.
    const data = await response.clone().json() as any;

    if (data.id) {
      try {
        await c.env.DB.prepare('INSERT INTO environments (id, user_id) VALUES (?, ?)')
          .bind(data.id, user.id)
          .run();
      } catch (err: unknown) {
        await archiveUpstreamResource(c, 'environments', data.id, 'Failed to persist local environment ownership after upstream create');
        if (isConstraintError(err)) {
          return c.json({ error: 'Environment already exists' }, 409);
        }
        console.error('Failed to store local environment ownership after creating environment', err);
        return c.json({ error: 'Failed to store local environment ownership after creating environment' }, 500);
      }
    }

    return response;
  } catch (err: unknown) {
    return c.json({ error: getErrorMessage(err) }, 500)
  }
})

app.get('/environments', async (c) => {
  try {
    if (!c.env.ANTHROPIC_API_KEY) {
      return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
    }
    const user = getUser(c);
    const { results } = await c.env.DB.prepare('SELECT id FROM environments WHERE user_id = ?')
      .bind(user.id)
      .all<{ id: string }>();
    const ownedEnvironmentIds = new Set(results.map((row: { id: string }) => row.id));
    if (ownedEnvironmentIds.size === 0) {
      return c.json({ data: [] });
    }

    const response = await fetchAnthropic(c, '/environments');

    if (!response.ok) {
      return response;
    }

    const data = await response.json() as any;
    if (Array.isArray(data?.data)) {
      data.data = data.data.filter((environment: { id?: string }) => environment.id && ownedEnvironmentIds.has(environment.id));
    } else {
      data.data = [];
    }
    return c.json(data);
  } catch (err: unknown) {
    return c.json({ error: getErrorMessage(err) }, 500)
  }
})

app.get('/environments/:environment_id', async (c) => {
  const ownershipError = await ensureEnvironmentOwnership(c, c.req.param('environment_id'));
  if (ownershipError) return ownershipError;
  return fetchAnthropic(c, `/environments/${c.req.param('environment_id')}`)
})

app.post('/environments/:environment_id', async (c) => {
  try {
    const ownershipError = await ensureEnvironmentOwnership(c, c.req.param('environment_id'));
    if (ownershipError) return ownershipError;
    const body = await c.req.json().catch(() => ({}))
    return fetchAnthropic(c, `/environments/${c.req.param('environment_id')}`, { method: 'POST', body: JSON.stringify(body) })
  } catch (err: unknown) {
    return c.json({ error: getErrorMessage(err) }, 500)
  }
})

app.delete('/environments/:environment_id', async (c) => {
  const ownershipError = await ensureEnvironmentOwnership(c, c.req.param('environment_id'));
  if (ownershipError) return ownershipError;
  const environmentId = c.req.param('environment_id');
  const response = await fetchAnthropic(c, `/environments/${environmentId}`, { method: 'DELETE' });
  if (response.ok) {
    try {
      await c.env.DB.prepare('DELETE FROM environments WHERE id = ?').bind(environmentId).run();
    } catch (err: unknown) {
      console.error('Failed to delete local environment ownership after upstream deletion', err);
    }
  }
  return response;
})

app.post('/environments/:environment_id/archive', async (c) => {
  const ownershipError = await ensureEnvironmentOwnership(c, c.req.param('environment_id'));
  if (ownershipError) return ownershipError;
  return fetchAnthropic(c, `/environments/${c.req.param('environment_id')}/archive`, { method: 'POST' })
})



// ----- MCP Connections & Tools Endpoints -----
app.get('/mcp/connections', async (c) => {
  try {
    const user = c.get('user');
    const { results } = await c.env.DB.prepare('SELECT DISTINCT provider FROM oauth_tokens WHERE user_id = ?').bind(user.id).all();
    return c.json({ connections: results.map(r => r.provider) });
  } catch (error: unknown) {
    return c.json({ error: getErrorMessage(error) }, 500)
  }
});

app.get('/mcp/tools/:provider', async (c) => {
  try {
    const provider = c.req.param('provider');
    const { results } = await c.env.DB.prepare('SELECT tool_name, type, permission FROM global_tool_permissions WHERE provider = ?').bind(provider).all();

    // Group tools by type
    const tools = results.reduce((acc: any, tool: any) => {
      acc[tool.type] = acc[tool.type] || [];
      acc[tool.type].push({ name: tool.tool_name, status: tool.permission.charAt(0).toUpperCase() + tool.permission.slice(1) });
      return acc;
    }, { read_only: [], write_delete: [] });

    return c.json(tools);
  } catch (error: unknown) {
    return c.json({ error: getErrorMessage(error) }, 500)
  }
});

app.post('/mcp/tools/:provider/:tool_name', async (c) => {
  try {
    const user = c.get('user');
    if (!user.roles?.includes('admin')) {
      return c.json({ error: 'Forbidden: Admin access required' }, 403);
    }

    const provider = c.req.param('provider');
    const tool_name = decodeURIComponent(c.req.param('tool_name'));
    const body = await c.req.json().catch(() => ({}));
    const permission = body.permission?.toLowerCase();

    // Simple validation
    if (!permission || !['allow', 'ask', 'deny', 'auto'].includes(permission)) {
      return c.json({ error: 'Invalid permission' }, 400);
    }

    await c.env.DB.prepare('UPDATE global_tool_permissions SET permission = ?, updated_at = CURRENT_TIMESTAMP WHERE provider = ? AND tool_name = ?')
      .bind(permission, provider, tool_name)
      .run();

    return c.json({ success: true });
  } catch (error: unknown) {
    return c.json({ error: getErrorMessage(error) }, 500)
  }
});


export { RealtimeStateObject }

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    console.log('Cron trigger executed at', event.cron)
  }
}
