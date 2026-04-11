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
    const oktaDomain = c.env.OKTA_DOMAIN || 'https://dev-00000000.okta.com';

    // Initialize or re-initialize if domain changes
    if (!cachedJWKS || lastOktaDomain !== oktaDomain) {
      const jwksUri = new URL(`${oktaDomain}/oauth2/default/v1/keys`);
      cachedJWKS = createRemoteJWKSet(jwksUri);
      lastOktaDomain = oktaDomain;
    }

    const { payload } = await jwtVerify(token, cachedJWKS, {
      issuer: `${oktaDomain}/oauth2/default`,
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

app.get('/', (c) => {
  return c.text('Multiplayer Managed Agents Platform API')
})

// Anthropic Managed Agents API Endpoints
app.post('/agents', async (c) => {
  // Placeholder for creating an agent
  return c.json({ message: 'Agent created', agent_id: 'ag_123' })
})

app.post('/sessions', async (c) => {
  // Placeholder for creating a session
  return c.json({ message: 'Session created', session_id: 'sess_123' })
})

app.post('/runs', async (c) => {
  // Placeholder for creating a run
  return c.json({ message: 'Run started', run_id: 'run_123' })
})

// SSE Streaming for Run Responses
app.get('/runs/:id/stream', (c) => {
  const id = c.req.param('id')

  return streamSSE(c, async (stream) => {
    // Placeholder for Anthropic API SSE streaming
    // e.g. using @anthropic-ai/sdk's streaming capabilities
    await stream.writeSSE({
      data: JSON.stringify({ status: 'running', run_id: id }),
      event: 'update',
      id: String(Date.now()),
    })

    // Simulate work
    await new Promise((resolve) => setTimeout(resolve, 1000))

    await stream.writeSSE({
      data: JSON.stringify({ status: 'completed', run_id: id }),
      event: 'complete',
      id: String(Date.now()),
    })
  })
})

// Export Durable Object class
export { RealtimeStateObject }

// Export default app and Cron handler
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    // Background Tasks: Cloudflare Cron Triggers (for the scheduling feature)
    console.log('Cron trigger executed at', event.cron)
    // Implement scheduled config checks and agent invocations here
  }
}
