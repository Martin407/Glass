import type { SSEStreamingApi } from 'hono/streaming'
import type { Anthropic } from '@anthropic-ai/sdk'

const getErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

export const processSessionStream = async (
  stream: SSEStreamingApi,
  sessionStream: unknown,
  client: Anthropic,
  sessionId: string,
  events: unknown[]
) => {
  const typedStream = sessionStream as { [Symbol.asyncIterator](): AsyncIterator<unknown>; controller: { abort(): void; signal: AbortSignal } };

  if (events.length > 0) {
    // Send events asynchronously without awaiting so the stream can start processing them immediately.
    // Use void to explicitly discard the returned Promise (fire-and-forget with handled rejection).
    void client.beta.sessions.events.send(sessionId, { events } as Parameters<typeof client.beta.sessions.events.send>[1]).catch((err: unknown) => {
      console.error('Error sending events to stream:', err);
      // Abort the session stream so the for-await loop below terminates instead of hanging.
      typedStream.controller.abort();
      stream.writeSSE({
        data: JSON.stringify({ error: getErrorMessage(err) }),
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
    if (!typedStream.controller.signal.aborted) {
      await stream.writeSSE({
        data: JSON.stringify({ error: getErrorMessage(err) }),
        event: 'error',
      });
    }
  }
}
