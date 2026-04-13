import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { RealtimeStateObject } from './durable-object'

// Setup global Mock for WebSocketPair
class MockWebSocket {
  listeners: Record<string, Function[]> = {}

  addEventListener(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
  }

  send = vi.fn()
  close = vi.fn()
}

class MockWebSocketPair {
  constructor() {
    return {
      0: new MockWebSocket(), // client
      1: new MockWebSocket(), // server
    }
  }
}

// Capture the original Response before stubbing so MockResponse can extend it
const OriginalResponse = (globalThis as any).Response as typeof Response

// We need to mock Response because the native Response object
// doesn't allow a 101 status code by default in Node.js/Vitest
class MockResponse extends OriginalResponse {
  constructor(body?: BodyInit | null, init?: ResponseInit) {
    if (init?.status === 101) {
      // Bypass RangeError for status 101 by constructing with 200, then overriding
      super(body, { ...init, status: 200 })
      Object.defineProperty(this, 'status', { value: 101 })
      Object.defineProperty(this, 'webSocket', { value: (init as any).webSocket })
    } else {
      super(body, init)
    }
  }
}

beforeAll(() => {
  vi.stubGlobal('WebSocketPair', MockWebSocketPair)
  vi.stubGlobal('Response', MockResponse)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('RealtimeStateObject', () => {
  describe('fetch', () => {
    it('should return 426 if Upgrade header is not websocket', async () => {
      const state = { acceptWebSocket: vi.fn() } as unknown as DurableObjectState
      const env = {}
      const ro = new RealtimeStateObject(state, env)

      const request = new Request('http://localhost/', {
        headers: { 'Upgrade': 'somethingelse' }
      })

      const response = await ro.fetch(request)
      expect(response.status).toBe(426)
      expect(await response.text()).toBe('Expected Upgrade: websocket')
    })

    it('should handle websocket upgrade request correctly', async () => {
      const state = { acceptWebSocket: vi.fn() } as unknown as DurableObjectState
      const env = {}
      const ro = new RealtimeStateObject(state, env)

      const request = new Request('http://localhost/', {
        headers: { 'Upgrade': 'websocket' }
      })

      const response = await ro.fetch(request)
      expect(response.status).toBe(101)
      expect(state.acceptWebSocket).toHaveBeenCalledTimes(1)

      // Checking that session was added
      expect(ro.sessions.size).toBe(1)
    })

    it('should broadcast update when server receives message', async () => {
      const state = { acceptWebSocket: vi.fn() } as unknown as DurableObjectState
      const env = {}
      const ro = new RealtimeStateObject(state, env)

      // We spy on broadcast
      vi.spyOn(ro, 'broadcast')

      const request = new Request('http://localhost/', {
        headers: { 'Upgrade': 'websocket' }
      })

      const response = await ro.fetch(request)
      expect(response.status).toBe(101)

      // Need to find the server websocket to trigger the event
      const server = Array.from(ro.sessions)[0] as unknown as MockWebSocket

      expect(server.listeners['message']).toBeDefined()

      // Trigger message event
      const eventHandler = server.listeners['message'][0]
      const testData = { text: 'hello' }
      await eventHandler({ data: JSON.stringify(testData) })

      // Broadcast should have been called with correctly formatted message
      expect(ro.broadcast).toHaveBeenCalledWith(JSON.stringify({
        type: 'update',
        data: testData
      }))
    })

    it('should remove session when server receives close event', async () => {
      const state = { acceptWebSocket: vi.fn() } as unknown as DurableObjectState
      const env = {}
      const ro = new RealtimeStateObject(state, env)

      const request = new Request('http://localhost/', {
        headers: { 'Upgrade': 'websocket' }
      })

      await ro.fetch(request)
      expect(ro.sessions.size).toBe(1)

      const server = Array.from(ro.sessions)[0] as unknown as MockWebSocket
      expect(server.listeners['close']).toBeDefined()

      // Trigger close event
      const closeHandler = server.listeners['close'][0]
      closeHandler()

      expect(ro.sessions.size).toBe(0)
    })
  })

  describe('broadcast', () => {
    it('should send a message to all connected sessions', () => {
      // Mock DurableObjectState and env
      const state = {} as DurableObjectState
      const env = {}

      const ro = new RealtimeStateObject(state, env)

      // Mock WebSocket sessions
      const session1 = { send: vi.fn() } as unknown as WebSocket
      const session2 = { send: vi.fn() } as unknown as WebSocket

      ro.sessions.add(session1)
      ro.sessions.add(session2)

      const message = 'test message'
      ro.broadcast(message)

      expect(session1.send).toHaveBeenCalledWith(message)
      expect(session2.send).toHaveBeenCalledWith(message)
      expect(ro.sessions.size).toBe(2)
    })

    it('should remove sessions that throw an error during send', () => {
      // Mock DurableObjectState and env
      const state = {} as DurableObjectState
      const env = {}

      const ro = new RealtimeStateObject(state, env)

      // Mock WebSocket sessions
      const session1 = { send: vi.fn() } as unknown as WebSocket
      const session2 = {
        send: vi.fn(() => {
          throw new Error('Connection lost')
        })
      } as unknown as WebSocket
      const session3 = { send: vi.fn() } as unknown as WebSocket

      ro.sessions.add(session1)
      ro.sessions.add(session2)
      ro.sessions.add(session3)

      const message = 'test message'
      ro.broadcast(message)

      expect(session1.send).toHaveBeenCalledWith(message)
      expect(session2.send).toHaveBeenCalledWith(message)
      expect(session3.send).toHaveBeenCalledWith(message)

      // Session 2 should have been removed, size should be 2
      expect(ro.sessions.size).toBe(2)
      expect(ro.sessions.has(session1)).toBe(true)
      expect(ro.sessions.has(session2)).toBe(false)
      expect(ro.sessions.has(session3)).toBe(true)
    })
  })
})
