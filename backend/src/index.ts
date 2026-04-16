import { Context, Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

const getErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);
import { RealtimeStateObject } from './durable-object'
import { Anthropic } from '@anthropic-ai/sdk'
import { jwtVerify, createRemoteJWKSet } from 'jose'
import { processSessionStream } from './stream'

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

export class TTLMemoryCache {
  private cache = new Map<string, { value: string; expires: number }>();
  private readonly maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: string): string | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return undefined;
    }
    return item.value;
  }

  set(key: string, value: string, ttl: number) {
    if (this.cache.size >= this.maxSize) {
      // Lazy eviction for space: delete the first expired item found,
      // or simply the first item (oldest inserted) if none are expired.
      for (const [k, v] of this.cache.entries()) {
        if (Date.now() > v.expires) {
          this.cache.delete(k);
          break;
        }
      }
      if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey !== undefined) {
            this.cache.delete(firstKey);
        }
      }
    }
    this.cache.set(key, { value, expires: Date.now() + ttl });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }
}

type Variables = {
  user: { id: string; roles?: string[] }
  cache: TTLMemoryCache
}

export type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>

export const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.onError((err, c) => {
  return c.json({ error: getErrorMessage(err) }, 500)
})

// ----- MCP OAuth Helpers (PKCE + dynamic client registration) -----
// Shared by all providers that use the RFC 7591 / RFC 8414 MCP OAuth flow.

/**
 * MCP OAuth discovery URLs per provider (RFC 8414 Authorization Server Metadata).
 * Add new providers here as their MCP servers become available.
 */
const PROVIDER_MCP_DISCOVERY_URLS: Record<string, string> = {
  Linear: 'https://mcp.linear.app/.well-known/oauth-authorization-server',
  Slack: 'https://mcp.slack.com/.well-known/oauth-authorization-server',
  Notion: 'https://mcp.notion.com/.well-known/oauth-authorization-server',
  Figma: 'https://mcp.figma.com/.well-known/oauth-authorization-server',
};

/**
 * MCP Streamable HTTP server endpoints for tool discovery.
 * Derived from the same base domain as the discovery URLs.
 */
const PROVIDER_MCP_SERVER_URLS: Record<string, string> = {
  Linear: 'https://mcp.linear.app/mcp',
  Slack: 'https://mcp.slack.com/mcp',
  Notion: 'https://mcp.notion.com/mcp',
  Figma: 'https://mcp.figma.com/mcp',
};

interface McpToolFromServer {
  name: string;
  description?: string;
  annotations?: {
    readOnlyHint?: boolean;
  };
}

/**
 * Classify a tool as read_only or write_delete based on annotations and name heuristics.
 */
const classifyToolType = (tool: McpToolFromServer): 'read_only' | 'write_delete' => {
  if (tool.annotations?.readOnlyHint === true) return 'read_only';
  const readPattern = /\b(get|list|search|read|fetch|view|show|find|query|describe|check)\b/i;
  if (readPattern.test(tool.name) || readPattern.test(tool.description ?? '')) return 'read_only';
  return 'write_delete';
};

/**
 * Calls the provider's MCP server to list available tools, then upserts them
 * into global_tool_permissions (INSERT OR IGNORE to preserve existing permissions).
 */
export const fetchAndStoreMcpTools = async (
  provider: string,
  accessToken: string,
  db: D1Database,
): Promise<void> => {
  const serverUrl = PROVIDER_MCP_SERVER_URLS[provider];
  if (!serverUrl) return;

  const response = await fetch(serverUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });

  if (!response.ok) {
    throw new Error(`MCP tools/list returned ${response.status} for ${provider}`);
  }

  let tools: McpToolFromServer[] = [];
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('text/event-stream')) {
    // Streamable HTTP SSE response — scan lines for the result event
    const text = await response.text();
    for (const line of text.split('\n')) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6)) as { result?: { tools?: McpToolFromServer[] } };
          if (data?.result?.tools) {
            tools = data.result.tools;
            break;
          }
        } catch { /* skip malformed lines */ }
      }
    }
  } else {
    const data = await response.json() as { result?: { tools?: McpToolFromServer[] } };
    tools = data?.result?.tools ?? [];
  }

  // Upsert: insert new tools with default 'auto' permission, leave existing rows untouched
  for (const tool of tools) {
    const type = classifyToolType(tool);
    await db
      .prepare(
        `INSERT OR IGNORE INTO global_tool_permissions (provider, tool_name, type, permission)
         VALUES (?, ?, ?, 'auto')`,
      )
      .bind(provider, tool.name, type)
      .run();
  }
};

const toBase64Url = (buffer: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

const generateCodeVerifier = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes.buffer);
};

const generateCodeChallenge = async (verifier: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return toBase64Url(digest);
};

interface OAuthServerMetadata {
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
}

// ----- Generic OAuth Callback (PUBLIC — registered before auth middleware) -----
app.get('/integrations/:provider/callback', async (c) => {
  const provider = c.req.param('provider');
  const defaultReturnTo = new URL('/', c.req.url).origin;
  const code = c.req.query('code');
  const stateId = c.req.query('state');
  const oauthError = c.req.query('error');

  if (oauthError) {
    return c.redirect(`${defaultReturnTo}?oauth_error=${encodeURIComponent(oauthError)}&provider=${encodeURIComponent(provider)}`);
  }
  if (!code || !stateId) {
    return c.redirect(`${defaultReturnTo}?oauth_error=missing_params&provider=${encodeURIComponent(provider)}`);
  }

  // Look up the in-flight state row (10-minute TTL enforced in SQL)
  const state = await c.env.DB.prepare(`
    SELECT user_id, provider, client_id, client_secret, code_verifier, token_endpoint, return_to
    FROM oauth_state
    WHERE id = ? AND created_at > datetime('now', '-10 minutes')
  `).bind(stateId).first<{
    user_id: string;
    provider: string;
    client_id: string;
    client_secret: string | null;
    code_verifier: string;
    token_endpoint: string;
    return_to: string;
  }>();

  if (!state) {
    return c.redirect(`${defaultReturnTo}?oauth_error=invalid_state&provider=${encodeURIComponent(provider)}`);
  }

  // Consume the state row immediately to prevent replay
  await c.env.DB.prepare('DELETE FROM oauth_state WHERE id = ?').bind(stateId).run();

  const redirectUri = new URL(`/integrations/${provider}/callback`, c.req.url).toString();

  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: state.client_id,
    code_verifier: state.code_verifier,
  });

  const tokenHeaders: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (state.client_secret) {
    tokenHeaders['Authorization'] = `Basic ${btoa(`${state.client_id}:${state.client_secret}`)}`;
  }

  try {
    const tokenRes = await fetch(state.token_endpoint, {
      method: 'POST',
      headers: tokenHeaders,
      body: tokenBody.toString(),
    });

    if (!tokenRes.ok) {
      console.error(`${state.provider} token exchange failed:`, await tokenRes.text());
      return c.redirect(`${state.return_to}?oauth_error=token_exchange_failed&provider=${encodeURIComponent(state.provider)}`);
    }

    const tokenData = await tokenRes.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    // Ensure the user row exists (FK requirement for oauth_tokens)
    await c.env.DB.prepare('INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)')
      .bind(state.user_id, `${state.user_id}@oauth.local`)
      .run();

    // Upsert the token — one row per user per provider
    const tokenId = crypto.randomUUID();
    await c.env.DB.prepare(`
      INSERT INTO oauth_tokens (id, user_id, provider, access_token, refresh_token, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, provider) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at,
        updated_at = CURRENT_TIMESTAMP
    `).bind(tokenId, state.user_id, state.provider, tokenData.access_token, tokenData.refresh_token ?? null, expiresAt).run();

    // Discover and store available tools from the MCP server (best-effort, non-blocking)
    fetchAndStoreMcpTools(state.provider, tokenData.access_token, c.env.DB).catch((err) => {
      console.warn(`${state.provider} MCP tool discovery failed (non-fatal):`, err);
    });

    return c.redirect(`${state.return_to}?connected=${encodeURIComponent(state.provider)}`);
  } catch (err) {
    console.error(`${state.provider} OAuth callback error:`, err);
    return c.redirect(`${state.return_to}?oauth_error=server_error&provider=${encodeURIComponent(state.provider)}`);
  }
});

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let jwksIssuer: string | undefined;
const globalCache = new TTLMemoryCache();
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

export const getOktaAudience = (configuredAudience?: string, clientId?: string) =>
  configuredAudience ?? clientId;

const getUser = (c: AppContext): { id: string } => c.get('user');

const LOCAL_DEV_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

export const isLocalDevRequest = (url: string): boolean => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return LOCAL_DEV_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost');
  } catch {
    return false;
  }
};

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

const ensureAgentOwnership = async (c: AppContext, agentId: string): Promise<Response | undefined> => {
  const user = getUser(c);
  const cacheObj = c.get('cache');
  const cacheKey = `agent_owner_${agentId}`;
  let ownerId = cacheObj?.get(cacheKey);

  if (!ownerId) {
    const owner = await c.env.DB.prepare('SELECT user_id FROM agents WHERE id = ?')
      .bind(agentId)
      .first<{ user_id: string }>();
    if (owner) {
      ownerId = owner.user_id;
      // Cache ownership check for 1 minute (60,000 ms)
      cacheObj?.set(cacheKey, ownerId, 60000);
    }
  }

  if (!ownerId || ownerId !== user.id) {
    return c.json({ error: 'Agent not found or unauthorized' }, 403);
  }
};

export const ensureSessionOwnership = async (c: AppContext, sessionId: string): Promise<Response | undefined> => {
  const user = getUser(c);
  const cacheObj = c.get('cache');
  const cacheKey = `session_owner_${sessionId}`;
  let ownerId = cacheObj?.get(cacheKey);

  if (!ownerId) {
    const owner = await c.env.DB.prepare('SELECT user_id FROM sessions WHERE id = ?')
      .bind(sessionId)
      .first<{ user_id: string }>();
    if (owner) {
      ownerId = owner.user_id;
      cacheObj?.set(cacheKey, ownerId, 60000);
    }
  }

  if (!ownerId || ownerId !== user.id) {
    return c.json({ error: 'Session not found or unauthorized' }, 403);
  }
};

const ensureEnvironmentOwnership = async (c: AppContext, environmentId: string): Promise<Response | undefined> => {
  const user = getUser(c);
  const cacheObj = c.get('cache');
  const cacheKey = `env_owner_${environmentId}`;
  let ownerId = cacheObj?.get(cacheKey);

  if (!ownerId) {
    const owner = await c.env.DB.prepare('SELECT user_id FROM environments WHERE id = ?')
      .bind(environmentId)
      .first<{ user_id: string }>();
    if (owner) {
      ownerId = owner.user_id;
      cacheObj?.set(cacheKey, ownerId, 60000);
    }
  }

  if (!ownerId || ownerId !== user.id) {
    return c.json({ error: 'Environment not found or unauthorized' }, 403);
  }
};

export const archiveUpstreamResource = async (
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
  c.set('cache', globalCache);
  if (c.env.AUTH_BYPASS_FOR_DEV === 'true' || (!c.env.OKTA_DOMAIN && isLocalDevRequest(c.req.url))) {
    c.set('user', { id: 'user-123', roles: ['admin'] });
    return await next();
  }

  if (!c.env.OKTA_DOMAIN) {
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
}

app.get('/', (c) => {
  return c.text('Multiplayer Managed Agents Platform API')
})


// ----- Schedule Configs Endpoints -----

// ----- GitHub Webhook Endpoint -----
app.post('/webhooks/github', async (c) => {
  const eventName = c.req.header('x-github-event');
  if (!eventName) {
    return c.json({ error: 'Missing x-github-event header' }, 400);
  }

  const payload = await c.req.json().catch(() => ({}));
  const repoFullName = payload.repository?.full_name;
  if (!repoFullName) {
    return c.json({ success: true, message: 'Ignored: no repository data' });
  }

  // Find all active github routines matching this repo and event
  const configs = await c.env.DB.prepare('SELECT * FROM schedule_configs WHERE trigger_type = "github" AND is_active = 1 AND github_repo = ?')
    .bind(repoFullName)
    .all();

  const matchingConfigs = configs.results.filter(cfg => {
    try {
      const events = JSON.parse(cfg.github_events as string || '[]');
      // Simple match: if event name is in the list, or if the user specified action like 'pull_request.opened'
      const action = payload.action;
      const fullEvent = action ? `${eventName}.${action}` : eventName;

      return events.includes(eventName) || events.includes(fullEvent);
    } catch (e) {
      return false;
    }
  });

  for (const config of matchingConfigs) {
    // Start session for matching routine
    const sessionId = crypto.randomUUID();
    let msg = `GitHub event triggered: ${eventName}`;
    if (payload.action) msg += `.${payload.action}`;

    if (config.payload) {
      try {
        const payloadObj = JSON.parse(config.payload as string);
        if (payloadObj.message) msg += `
Payload: ${payloadObj.message}`;
      } catch (e) {}
    }

    const sessionPayload = {
      id: sessionId,
      agent: config.agent_id,
      message: msg
    };

    // In a real app we'd probably use a queue, but we just trigger it directly here
    const response = await fetchAnthropic(c, '/sessions', { method: 'POST', body: JSON.stringify(sessionPayload) });
    if (response.ok) {
      await c.env.DB.prepare('INSERT INTO sessions (id, user_id) VALUES (?, ?)')
        .bind(sessionId, config.user_id)
        .run();
    }
  }

  return c.json({ success: true, triggered: matchingConfigs.length });
});


app.post('/v1/claude_code/routines/:api_token/fire', async (c) => {
  const token = c.req.param('api_token');
  const body = await c.req.json().catch(() => ({}));
  const text = body.text || '';

  const config = await c.env.DB.prepare('SELECT * FROM schedule_configs WHERE api_token = ? AND is_active = 1').bind(token).first();
  if (!config) {
    return c.json({ error: 'Invalid or inactive token' }, 401);
  }

  const sessionId = crypto.randomUUID();
  let msg = 'API trigger fired.';
  if (text) {
    msg += ` Additional context: ${text}`;
  }
  if (config.payload) {
    try {
      const payloadObj = JSON.parse(config.payload as string);
      if (payloadObj.message) msg += `
Payload: ${payloadObj.message}`;
    } catch (e) {}
  }

  const payload = {
    id: sessionId,
    agent: config.agent_id,
    message: msg
  };

  const response = await fetchAnthropic(c, '/sessions', { method: 'POST', body: JSON.stringify(payload) });
  if (!response.ok) return handleAnthropicError(c, response);

  await c.env.DB.prepare('INSERT INTO sessions (id, user_id) VALUES (?, ?)')
    .bind(sessionId, config.user_id)
    .run();

  return c.json({
    type: 'routine_fire',
    claude_code_session_id: sessionId,
    claude_code_session_url: `https://claude.ai/code/${sessionId}`
  });
});


app.get('/schedule-configs', async (c) => {
  const user = getUser(c);
  const result = await c.env.DB.prepare('SELECT * FROM schedule_configs WHERE user_id = ? ORDER BY created_at DESC')
    .bind(user.id)
    .all();
  return c.json({ data: result.results });
});

app.post('/schedule-configs', async (c) => {
  const user = getUser(c);
  const body = await c.req.json().catch(() => ({}));
  const id = crypto.randomUUID();
  const agent_id = body.agent_id;
  const is_active = body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1;
  const payload = body.payload ? JSON.stringify(body.payload) : null;
  const trigger_type = body.trigger_type || 'schedule';

  if (!agent_id) {
    return c.json({ error: 'agent_id is required' }, 400);
  }

  const cron_expression = body.cron_expression || '';
  const api_token = trigger_type === 'api' ? crypto.randomUUID() : null;
  const github_repo = body.github_repo || null;
  const github_events = body.github_events ? JSON.stringify(body.github_events) : null;
  const github_filters = body.github_filters ? JSON.stringify(body.github_filters) : null;

  await c.env.DB.prepare('INSERT INTO schedule_configs (id, user_id, agent_id, cron_expression, is_active, payload, trigger_type, api_token, github_repo, github_events, github_filters) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, user.id, agent_id, cron_expression, is_active, payload, trigger_type, api_token, github_repo, github_events, github_filters)
    .run();

  return c.json({ id, user_id: user.id, agent_id, cron_expression, is_active, payload, trigger_type, api_token, github_repo, github_events, github_filters });
});

app.get('/schedule-configs/:id', async (c) => {
  const user = getUser(c);
  const id = c.req.param('id');
  const result = await c.env.DB.prepare('SELECT * FROM schedule_configs WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .first();
  if (!result) {
    return c.json({ error: 'Not found' }, 404);
  }
  return c.json(result);
});

app.post('/schedule-configs/:id', async (c) => {
  const user = getUser(c);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const existing = await c.env.DB.prepare('SELECT * FROM schedule_configs WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .first();

  if (!existing) {
    return c.json({ error: 'Not found' }, 404);
  }

  const agent_id = body.agent_id || existing.agent_id;
  const cron_expression = body.cron_expression !== undefined ? body.cron_expression : existing.cron_expression;
  const is_active = body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active;
  const payload = body.payload ? JSON.stringify(body.payload) : existing.payload;
  const trigger_type = body.trigger_type || existing.trigger_type;

  const github_repo = body.github_repo !== undefined ? body.github_repo : existing.github_repo;
  const github_events = body.github_events ? JSON.stringify(body.github_events) : existing.github_events;
  const github_filters = body.github_filters ? JSON.stringify(body.github_filters) : existing.github_filters;

  await c.env.DB.prepare('UPDATE schedule_configs SET agent_id = ?, cron_expression = ?, is_active = ?, payload = ?, trigger_type = ?, github_repo = ?, github_events = ?, github_filters = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
    .bind(agent_id, cron_expression, is_active, payload, trigger_type, github_repo, github_events, github_filters, id, user.id)
    .run();

  return c.json({ id, user_id: user.id, agent_id, cron_expression, is_active, payload, trigger_type, github_repo, github_events, github_filters });
});

app.delete('/schedule-configs/:id', async (c) => {
  const user = getUser(c);
  const id = c.req.param('id');

  const result = await c.env.DB.prepare('DELETE FROM schedule_configs WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: 'Not found' }, 404);
  }

  return c.json({ success: true });
});


// ----- Agents Endpoints -----
app.post('/agents', async (c) => {
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
})

app.get('/agents', async (c) => {
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
})

app.get('/agents/:agent_id', async (c) => {
  const ownershipError = await ensureAgentOwnership(c, c.req.param('agent_id'));
  if (ownershipError) return ownershipError;
  return fetchAnthropic(c, `/agents/${c.req.param('agent_id')}`)
})

app.post('/agents/:agent_id', async (c) => {
  const ownershipError = await ensureAgentOwnership(c, c.req.param('agent_id'));
  if (ownershipError) return ownershipError;
  const body = await c.req.json().catch(() => ({}))
  return fetchAnthropic(c, `/agents/${c.req.param('agent_id')}`, { method: 'POST', body: JSON.stringify(body) })
})

app.delete('/agents/:agent_id', async (c) => {
  const agentId = c.req.param('agent_id');
  const ownershipError = await ensureAgentOwnership(c, agentId);
  if (ownershipError) return ownershipError;
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }
  const response = await fetch(`https://api.anthropic.com/v1/agents/${agentId}`, {
    method: 'DELETE',
    headers: getAnthropicHeaders(c),
  });
  if (!response.ok) {
    return handleAnthropicError(c, response);
  }
  try {
    await c.env.DB.prepare('DELETE FROM agents WHERE id = ?').bind(agentId).run();
  } catch (err: unknown) {
    console.error('Failed to delete local agent ownership after upstream deletion', err);
  }
  c.get('cache').delete(`agent_owner_${agentId}`);
  const data = await response.json().catch(() => ({}));
  return c.json(data);
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

const resolveManagedAgentIdForSession = (body: Record<string, unknown>): string | undefined => {
  if (typeof body.agent === 'string') return body.agent;
  const agentObj = body.agent;
  if (agentObj && typeof agentObj === 'object' && !Array.isArray(agentObj) && typeof (agentObj as { id?: unknown }).id === 'string') {
    return (agentObj as { id: string }).id;
  }
  if (typeof body.agent_id === 'string') return body.agent_id;
  return undefined;
};

/** Anthropic create-session expects `agent` (string or object), not `agent_id`. */
const buildAnthropicSessionCreateBody = (body: Record<string, unknown>): Record<string, unknown> => {
  const out = { ...body };
  delete out.agent_id;
  if (typeof body.agent_id === 'string' && body.agent === undefined) {
    out.agent = body.agent_id;
  }
  return out;
};

// ----- Sessions Endpoints -----
app.post('/sessions', async (c) => {
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500)
  }
  const user = getUser(c)
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const agentId = resolveManagedAgentIdForSession(body);
  if (!agentId) {
    return c.json({ error: 'agent is required (string agent id, or agent object with id)' }, 400);
  }
  const ownershipError = await ensureAgentOwnership(c, agentId);
  if (ownershipError) return ownershipError;

  const environmentId = typeof body.environment_id === 'string' ? body.environment_id : undefined;
  if (environmentId) {
    const envOwnershipError = await ensureEnvironmentOwnership(c, environmentId);
    if (envOwnershipError) return envOwnershipError;
  }

  const anthropicBody = buildAnthropicSessionCreateBody(body);

  // Create session in Anthropic
  const response = await fetch(`https://api.anthropic.com/v1/sessions`, {
    method: 'POST',
    body: JSON.stringify(anthropicBody),
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
})

app.get('/sessions', async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare('SELECT id, created_at FROM sessions WHERE user_id = ?')
    .bind(user.id)
    .all()
  return c.json({ data: results })
})

app.get('/sessions/:session_id', async (c) => {
  const ownershipError = await ensureSessionOwnership(c, c.req.param('session_id'));
  if (ownershipError) return ownershipError;
  return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}`)
})

app.post('/sessions/:session_id', async (c) => {
  const ownershipError = await ensureSessionOwnership(c, c.req.param('session_id'));
  if (ownershipError) return ownershipError;
  const body = await c.req.json().catch(() => ({}))
  return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}`, { method: 'POST', body: JSON.stringify(body) })
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
      void client.beta.sessions.events.send(sessionId, { events }).catch((err: any) => {
        console.error('Error sending events to stream:', err);
        // Abort the session stream so the for-await loop below terminates instead of hanging.
        sessionStream.controller.abort();
        stream.writeSSE({
          data: JSON.stringify({ error: err.message }),
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
    } catch (err: any) {
      // If the stream was intentionally aborted (due to events.send failure above),
      // skip writing a duplicate/misleading error event — the catch above already sent one.
      if (!sessionStream.controller.signal.aborted) {
        await stream.writeSSE({
          data: JSON.stringify({ error: err.message }),
          event: 'error',
        });
      }
    }
  })
})

app.get('/sessions/:session_id/events', async (c) => {
  const ownershipError = await ensureSessionOwnership(c, c.req.param('session_id'));
  if (ownershipError) return ownershipError;
  return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}/events`)
})

app.post('/sessions/:session_id/events', async (c) => {
  const ownershipError = await ensureSessionOwnership(c, c.req.param('session_id'));
  if (ownershipError) return ownershipError;
  const body = await c.req.json().catch(() => ({}))
  return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}/events`, { method: 'POST', body: JSON.stringify(body) })
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
        data: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
        event: 'error',
      })
    }
  })
})

// ----- Session Resources Endpoints -----
app.post('/sessions/:session_id/resources', async (c) => {
  const ownershipError = await ensureSessionOwnership(c, c.req.param('session_id'));
  if (ownershipError) return ownershipError;
  const body = await c.req.json().catch(() => ({}))
  return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}/resources`, { method: 'POST', body: JSON.stringify(body) })
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
  const ownershipError = await ensureSessionOwnership(c, c.req.param('session_id'));
  if (ownershipError) return ownershipError;
  const body = await c.req.json().catch(() => ({}))
  return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}/resources/${c.req.param('resource_id')}`, { method: 'POST', body: JSON.stringify(body) })
})

app.delete('/sessions/:session_id/resources/:resource_id', async (c) => {
  const ownershipError = await ensureSessionOwnership(c, c.req.param('session_id'));
  if (ownershipError) return ownershipError;
  return fetchAnthropic(c, `/sessions/${c.req.param('session_id')}/resources/${c.req.param('resource_id')}`, { method: 'DELETE' })
})

// ----- Environments Endpoints -----

const getAnthropicClient = (c: AppContext) => {
  const user = c.get('user');
  return new Anthropic({
    apiKey: c.env.ANTHROPIC_API_KEY,
    defaultHeaders: user?.id ? { 'x-okta-user-id': user.id } : undefined,
  });
};

const handleSdkError = (c: AppContext, err: unknown) => {
  const status = (err as any)?.status ?? 500;
  const message = (err as any)?.message ?? 'Unknown error';
  return c.json({ error: message }, status);
};

app.post('/environments', async (c) => {
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }
  const user = getUser(c);
  const body = await c.req.json().catch(() => ({}));

  let data: any;
  try {
    data = await getAnthropicClient(c).beta.environments.create(body);
  } catch (err: unknown) {
    return handleSdkError(c, err);
  }

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

  return c.json(data);
})

app.get('/environments', async (c) => {
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

  let response: any;
  try {
    response = await getAnthropicClient(c).beta.environments.list();
  } catch (err: unknown) {
    return handleSdkError(c, err);
  }

  const allEnvironments: { id?: string }[] = Array.isArray(response?.data) ? response.data : [];
  return c.json({ data: allEnvironments.filter((env) => env.id && ownedEnvironmentIds.has(env.id)) });
})

app.get('/environments/:environment_id', async (c) => {
  const ownershipError = await ensureEnvironmentOwnership(c, c.req.param('environment_id'));
  if (ownershipError) return ownershipError;
  try {
    const data = await getAnthropicClient(c).beta.environments.retrieve(c.req.param('environment_id'));
    return c.json(data);
  } catch (err: unknown) {
    return handleSdkError(c, err);
  }
})

app.post('/environments/:environment_id', async (c) => {
  const ownershipError = await ensureEnvironmentOwnership(c, c.req.param('environment_id'));
  if (ownershipError) return ownershipError;
  const body = await c.req.json().catch(() => ({}));
  try {
    const data = await getAnthropicClient(c).beta.environments.update(c.req.param('environment_id'), body);
    return c.json(data);
  } catch (err: unknown) {
    return handleSdkError(c, err);
  }
})

app.delete('/environments/:environment_id', async (c) => {
  const ownershipError = await ensureEnvironmentOwnership(c, c.req.param('environment_id'));
  if (ownershipError) return ownershipError;
  const environmentId = c.req.param('environment_id');
  try {
    const data = await getAnthropicClient(c).beta.environments.delete(environmentId);
    try {
      await c.env.DB.prepare('DELETE FROM environments WHERE id = ?').bind(environmentId).run();
    } catch (err: unknown) {
      console.error('Failed to delete local environment ownership after upstream deletion', err);
    }
    c.get('cache').delete(`env_owner_${environmentId}`);
    return c.json(data);
  } catch (err: unknown) {
    return handleSdkError(c, err);
  }
})

app.post('/environments/:environment_id/archive', async (c) => {
  const ownershipError = await ensureEnvironmentOwnership(c, c.req.param('environment_id'));
  if (ownershipError) return ownershipError;
  try {
    const data = await getAnthropicClient(c).beta.environments.archive(c.req.param('environment_id'));
    return c.json(data);
  } catch (err: unknown) {
    return handleSdkError(c, err);
  }
})



// ----- Credential Vault Endpoints -----

const ensureVaultOwnership = async (c: AppContext, vaultId: string): Promise<Response | undefined> => {
  const user = getUser(c);
  const vault = await c.env.DB.prepare(
    'SELECT id FROM credential_vaults WHERE id = ? AND user_id = ?',
  ).bind(vaultId, user.id).first();
  if (!vault) {
    return c.json({ error: 'Vault not found or unauthorized' }, 403);
  }
};

/**
 * GET /credential-vaults — return the user's local vault record(s).
 * We store one vault per user in D1; the Anthropic vault ID is the primary key.
 */
app.get('/credential-vaults', async (c) => {
  const user = getUser(c);
  const { results } = await c.env.DB.prepare(
    'SELECT id, created_at FROM credential_vaults WHERE user_id = ?',
  ).bind(user.id).all<{ id: string; created_at: string }>();
  return c.json({ data: results });
});

/**
 * POST /credential-vaults — create a new credential vault on Anthropic and record it locally.
 */
app.post('/credential-vaults', async (c) => {
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }
  const user = getUser(c);
  const body = await c.req.json().catch(() => ({}));

  const response = await fetch('https://api.anthropic.com/v1/credential_vaults', {
    method: 'POST',
    headers: getAnthropicHeaders(c),
    body: JSON.stringify(body),
  });

  if (!response.ok) return handleAnthropicError(c, response);

  const data = await response.json() as { id?: string };
  if (data.id) {
    await c.env.DB.prepare('INSERT OR REPLACE INTO credential_vaults (id, user_id) VALUES (?, ?)')
      .bind(data.id, user.id).run();
  }
  return c.json(data);
});

/**
 * DELETE /credential-vaults/:vault_id — archive vault on Anthropic and remove local record.
 */
app.delete('/credential-vaults/:vault_id', async (c) => {
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }
  const vaultId = c.req.param('vault_id');
  const user = getUser(c);

  const vault = await c.env.DB.prepare(
    'SELECT id FROM credential_vaults WHERE id = ? AND user_id = ?',
  ).bind(vaultId, user.id).first();
  if (!vault) return c.json({ error: 'Vault not found or unauthorized' }, 404);

  const response = await fetch(`https://api.anthropic.com/v1/credential_vaults/${vaultId}`, {
    method: 'DELETE',
    headers: getAnthropicHeaders(c),
  });

  await c.env.DB.prepare('DELETE FROM credential_vaults WHERE id = ?').bind(vaultId).run();

  if (!response.ok) return handleAnthropicError(c, response);
  const data = await response.json().catch(() => ({}));
  return c.json(data);
});

/**
 * GET /credential-vaults/:vault_id — retrieve a single vault.
 */
app.get('/credential-vaults/:vault_id', async (c) => {
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }
  const vaultId = c.req.param('vault_id');
  const ownershipError = await ensureVaultOwnership(c, vaultId);
  if (ownershipError) return ownershipError;
  try {
    const data = await getAnthropicClient(c).beta.vaults.retrieve(vaultId);
    return c.json(data);
  } catch (err: unknown) {
    return handleSdkError(c, err);
  }
});

/**
 * POST /credential-vaults/:vault_id — update a vault.
 */
app.post('/credential-vaults/:vault_id', async (c) => {
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }
  const vaultId = c.req.param('vault_id');
  const ownershipError = await ensureVaultOwnership(c, vaultId);
  if (ownershipError) return ownershipError;
  const body = await c.req.json().catch(() => ({}));
  try {
    const data = await getAnthropicClient(c).beta.vaults.update(vaultId, body);
    return c.json(data);
  } catch (err: unknown) {
    return handleSdkError(c, err);
  }
});

/**
 * POST /credential-vaults/:vault_id/archive — archive a vault.
 */
app.post('/credential-vaults/:vault_id/archive', async (c) => {
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }
  const vaultId = c.req.param('vault_id');
  const ownershipError = await ensureVaultOwnership(c, vaultId);
  if (ownershipError) return ownershipError;
  try {
    const data = await getAnthropicClient(c).beta.vaults.archive(vaultId);
    return c.json(data);
  } catch (err: unknown) {
    return handleSdkError(c, err);
  }
});

/**
 * GET /credential-vaults/:vault_id/credentials — list credentials in a vault.
 */
app.get('/credential-vaults/:vault_id/credentials', async (c) => {
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }
  const vaultId = c.req.param('vault_id');
  const ownershipError = await ensureVaultOwnership(c, vaultId);
  if (ownershipError) return ownershipError;
  try {
    const data = await getAnthropicClient(c).beta.vaults.credentials.list(vaultId);
    return c.json(data);
  } catch (err: unknown) {
    return handleSdkError(c, err);
  }
});

/**
 * POST /credential-vaults/:vault_id/credentials — add an MCP OAuth credential to the vault.
 */
app.post('/credential-vaults/:vault_id/credentials', async (c) => {
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }
  const vaultId = c.req.param('vault_id');
  const ownershipError = await ensureVaultOwnership(c, vaultId);
  if (ownershipError) return ownershipError;
  const body = await c.req.json().catch(() => ({}));
  try {
    const data = await getAnthropicClient(c).beta.vaults.credentials.create(vaultId, body);
    return c.json(data);
  } catch (err: unknown) {
    return handleSdkError(c, err);
  }
});

/**
 * GET /credential-vaults/:vault_id/credentials/:credential_id — retrieve a single credential.
 */
app.get('/credential-vaults/:vault_id/credentials/:credential_id', async (c) => {
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }
  const vaultId = c.req.param('vault_id');
  const credentialId = c.req.param('credential_id');
  const ownershipError = await ensureVaultOwnership(c, vaultId);
  if (ownershipError) return ownershipError;
  try {
    const data = await getAnthropicClient(c).beta.vaults.credentials.retrieve(credentialId, { vault_id: vaultId });
    return c.json(data);
  } catch (err: unknown) {
    return handleSdkError(c, err);
  }
});

/**
 * POST /credential-vaults/:vault_id/credentials/:credential_id — update a credential.
 */
app.post('/credential-vaults/:vault_id/credentials/:credential_id', async (c) => {
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }
  const vaultId = c.req.param('vault_id');
  const credentialId = c.req.param('credential_id');
  const ownershipError = await ensureVaultOwnership(c, vaultId);
  if (ownershipError) return ownershipError;
  const body = await c.req.json().catch(() => ({}));
  try {
    const data = await getAnthropicClient(c).beta.vaults.credentials.update(credentialId, { vault_id: vaultId, ...body });
    return c.json(data);
  } catch (err: unknown) {
    return handleSdkError(c, err);
  }
});

/**
 * DELETE /credential-vaults/:vault_id/credentials/:credential_id — delete a credential.
 */
app.delete('/credential-vaults/:vault_id/credentials/:credential_id', async (c) => {
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }
  const vaultId = c.req.param('vault_id');
  const credentialId = c.req.param('credential_id');
  const ownershipError = await ensureVaultOwnership(c, vaultId);
  if (ownershipError) return ownershipError;
  try {
    const data = await getAnthropicClient(c).beta.vaults.credentials.delete(credentialId, { vault_id: vaultId });
    return c.json(data);
  } catch (err: unknown) {
    return handleSdkError(c, err);
  }
});

/**
 * POST /credential-vaults/:vault_id/credentials/:credential_id/archive — archive a credential.
 */
app.post('/credential-vaults/:vault_id/credentials/:credential_id/archive', async (c) => {
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }
  const vaultId = c.req.param('vault_id');
  const credentialId = c.req.param('credential_id');
  const ownershipError = await ensureVaultOwnership(c, vaultId);
  if (ownershipError) return ownershipError;
  try {
    const data = await getAnthropicClient(c).beta.vaults.credentials.archive(credentialId, { vault_id: vaultId });
    return c.json(data);
  } catch (err: unknown) {
    return handleSdkError(c, err);
  }
});

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
    const user = c.get('user');
    if (!user.roles?.includes('admin')) {
      return c.json({ error: 'Forbidden: Admin access required' }, 403);
    }
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

app.post('/mcp/:provider/tools/refresh', async (c) => {
  try {
    const user = c.get('user');
    if (!user.roles?.includes('admin')) {
      return c.json({ error: 'Forbidden: Admin access required' }, 403);
    }
    const provider = c.req.param('provider');

    // Use any stored token for this provider to discover tools
    const tokenRow = await c.env.DB.prepare(
      'SELECT access_token FROM oauth_tokens WHERE provider = ? LIMIT 1',
    ).bind(provider).first<{ access_token: string }>();

    if (!tokenRow) {
      return c.json({ error: `No connection found for ${provider}` }, 404);
    }

    await fetchAndStoreMcpTools(provider, tokenRow.access_token, c.env.DB);
    return c.json({ success: true });
  } catch (error: unknown) {
    return c.json({ error: getErrorMessage(error) }, 502);
  }
});

// ----- Generic OAuth Authorize & Disconnect (authenticated) -----
app.get('/integrations/:provider/authorize', async (c) => {
  const provider = c.req.param('provider');
  const user = getUser(c);
  const returnTo = c.req.query('return_to') ?? new URL('/', c.req.url).origin;
  const redirectUri = new URL(`/integrations/${provider}/callback`, c.req.url).toString();

  const discoveryUrl = PROVIDER_MCP_DISCOVERY_URLS[provider];
  if (!discoveryUrl) {
    return c.json({ error: `Provider '${provider}' is not configured for MCP OAuth` }, 404);
  }

  // 1. Discover MCP OAuth metadata
  let metadata: OAuthServerMetadata;
  try {
    const metaRes = await fetch(discoveryUrl, { headers: { Accept: 'application/json' } });
    if (!metaRes.ok) throw new Error(`HTTP ${metaRes.status}`);
    metadata = await metaRes.json() as OAuthServerMetadata;
  } catch (err) {
    console.error(`${provider} MCP metadata discovery failed:`, err);
    return c.json({ error: `Failed to discover ${provider} MCP OAuth endpoints` }, 502);
  }

  if (!metadata.registration_endpoint) {
    return c.json({ error: `${provider} MCP server does not advertise a registration endpoint` }, 501);
  }

  // 2. Dynamically register Glass as an OAuth client for this redirect URI (RFC 7591)
  let clientId: string;
  let clientSecret: string | undefined;
  try {
    const regRes = await fetch(metadata.registration_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Glass',
        redirect_uris: [redirectUri],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      }),
    });
    if (!regRes.ok) throw new Error(await regRes.text());
    const reg = await regRes.json() as { client_id: string; client_secret?: string };
    clientId = reg.client_id;
    clientSecret = reg.client_secret;
  } catch (err) {
    console.error(`${provider} dynamic client registration failed:`, err);
    return c.json({ error: `Failed to register with ${provider} MCP server` }, 502);
  }

  // 3. Generate PKCE pair
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // 4. Persist in-flight state to D1 (10-minute window enforced on read)
  const stateId = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO oauth_state (id, user_id, provider, client_id, client_secret, code_verifier, token_endpoint, return_to)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(stateId, user.id, provider, clientId, clientSecret ?? null, codeVerifier, metadata.token_endpoint, returnTo).run();

  // 5. Build and return the authorization URL
  const authUrl = new URL(metadata.authorization_endpoint);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', stateId);

  return c.json({ url: authUrl.toString() });
});

app.delete('/integrations/:provider/disconnect', async (c) => {
  const provider = c.req.param('provider');
  const user = getUser(c);
  await c.env.DB.prepare('DELETE FROM oauth_tokens WHERE user_id = ? AND provider = ?')
    .bind(user.id, provider)
    .run();
  return c.json({ success: true });
});

app.post('/mcp/tools/:provider/:tool_name', async (c) => {
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
});


export { RealtimeStateObject }

export default {
  fetch: app.fetch,
    async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    console.log('Cron trigger executed at', event.cron);
    // Find all scheduled routines that should run now
    // We would need to implement full cron parsing here.
    // For MVP, we'll just query all active scheduled routines and assume they run if their cron matches loosely
    // Note: A full cron evaluator library would be needed for production

    const db = env.DB;
    const configs = await db.prepare('SELECT * FROM schedule_configs WHERE trigger_type = "schedule" AND is_active = 1').all();

    for (const config of configs.results) {
        // Trigger it!
        const sessionId = crypto.randomUUID();
        let msg = `Scheduled routine triggered at ${event.cron}`;

        if (config.payload) {
          try {
            const payloadObj = JSON.parse(config.payload as string);
            if (payloadObj.message) msg += `
Payload: ${payloadObj.message}`;
          } catch (e) {}
        }

        const payload = {
          id: sessionId,
          agent: config.agent_id,
          message: msg
        };

        try {
            const headers: Record<string, string> = {
              'x-api-key': env.ANTHROPIC_API_KEY || '',
              'Content-Type': 'application/json',
              'anthropic-version': '2023-06-01',
              'anthropic-beta': 'agents-2025-02-19'
            };
            const response = await fetch('https://api.anthropic.com/v1/sessions', {
              method: 'POST',
              headers,
              body: JSON.stringify(payload)
            });

            if (response.ok) {
               await db.prepare('INSERT INTO sessions (id, user_id) VALUES (?, ?)')
                .bind(sessionId, config.user_id)
                .run();
               console.log(`Triggered session ${sessionId} for config ${config.id}`);
            }
        } catch (e) {
            console.error('Error triggering scheduled routine:', e);
        }
    }
  }
}
