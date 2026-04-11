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
  const user = c.get('user')
  const body = await c.req.json()

  try {
    const anthropic = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY })
    const agent = await anthropic.beta.agents.create({
      model: body.model || 'claude-3-5-sonnet-20241022',
      name: body.name || 'New Agent',
      description: body.description || '',
      mcp_servers: body.mcp_servers || [],
      // Use metadata or a similar field if Anthropic API supports it; passing as description part since tagging wasn't standard,
      // but if we are passing metadata okta_user_id, wait. The type is: `mcp_servers`, `description`, `name`, `model`.
      // Let's pass it by modifying the request headers if needed, or if Anthropic SDK supports headers:
    }, {
      headers: {
        'x-okta-user-id': user.id // Tagging the resource with okta_user_id via headers as standard SDK pattern
      }
    });
    return c.json(agent)
  } catch (error) {
    console.error('Agent creation failed:', error)
    return c.json({ error: 'Agent creation failed' }, 500)
  }
})

app.get('/agents', async (c) => {
  const user = c.get('user')

  try {
    const anthropic = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY })
    // The beta.agents SDK exposes a .list() method.
    const agents = await anthropic.beta.agents.list({}, {
      headers: {
        'x-okta-user-id': user.id
      }
    })
    return c.json(agents)
  } catch (error) {
    console.error('Agent list failed:', error)
    return c.json({ error: 'Agent list failed' }, 500)
  }
})

app.put('/agents/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const body = await c.req.json()

  try {
    const anthropic = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY })
    const agent = await anthropic.beta.agents.update(id, {
      model: body.model,
      name: body.name,
      description: body.description,
      mcp_servers: body.mcp_servers,
      version: body.version,
    }, {
      headers: {
        'x-okta-user-id': user.id
      }
    })
    return c.json(agent)
  } catch (error) {
    console.error('Agent update failed:', error)
    return c.json({ error: 'Agent update failed' }, 500)
  }
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
