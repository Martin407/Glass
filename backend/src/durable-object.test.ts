import { describe, it, expect, vi } from 'vitest'
import { RealtimeStateObject } from './durable-object'
import type { Bindings } from './index'

describe('RealtimeStateObject', () => {
  describe('broadcast', () => {
    it('should send a message to all connected sessions', () => {
      // Mock DurableObjectState and env
      const state = {} as DurableObjectState
      const env = {} as unknown as Bindings

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
      const env = {} as unknown as Bindings

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
