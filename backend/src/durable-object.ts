import type { Bindings } from './index'

export class RealtimeStateObject {
  state: DurableObjectState
  env: Bindings
  sessions: Set<WebSocket>

  constructor(state: DurableObjectState, env: Bindings) {
    this.state = state
    this.env = env
    this.sessions = new Set()
  }

  async fetch(request: Request) {
    // Handle WebSocket upgrade requests
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)

      this.state.acceptWebSocket(server)
      this.sessions.add(server)

      server.addEventListener('message', async (event) => {
        // Handle incoming messages
        const data = JSON.parse(event.data as string)

        // Broadcast to all connected clients
        this.broadcast(JSON.stringify({
          type: 'update',
          data: data
        }))
      })

      server.addEventListener('close', () => {
        this.sessions.delete(server)
      })

      return new Response(null, {
        status: 101,
        webSocket: client,
      })
    }

    return new Response('Expected Upgrade: websocket', { status: 426 })
  }

  broadcast(message: string) {
    for (const session of this.sessions) {
      try {
        session.send(message)
      } catch (err) {
        this.sessions.delete(session)
      }
    }
  }
}
