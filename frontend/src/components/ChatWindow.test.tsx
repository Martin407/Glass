import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatWindow } from './ChatWindow';
import { agentsApi } from '../lib/agentsApi';

// Partially mock agentsApi to preserve other methods while intercepting runSession
vi.mock('../lib/agentsApi', async () => {
  const actual = await vi.importActual('../lib/agentsApi') as any;
  return {
    agentsApi: {
      ...actual.agentsApi,
      runSession: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ id: 'test-session', title: null }),
      listSessionResources: vi.fn().mockResolvedValue({ resources: [] }),
    }
  };
});

describe('ChatWindow', () => {
  beforeEach(() => {
    let counter = 0;
    vi.stubGlobal('crypto', {
      randomUUID: () => `test-uuid-${counter++}`
    });
    vi.clearAllMocks();

    // Mock scrollIntoView
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('ignores invalid JSON in SSE stream and continues parsing', async () => {
    const mockRunSession = agentsApi.runSession as any;

    // Create a mock stream that sends:
    // 1. A malformed JSON data line
    // 2. A valid JSON data line with an agent message
    mockRunSession.mockResolvedValue({
      body: {
        getReader: () => {
          let readCount = 0;
          return {
            read: async () => {
              if (readCount === 0) {
                readCount++;
                const chunk = "data: { invalid_json }\ndata: {\"type\":\"agent.message\",\"content\":[{\"type\":\"text\",\"text\":\"Valid message\"}]}\n";
                return { done: false, value: new TextEncoder().encode(chunk) };
              }
              return { done: true, value: undefined };
            }
          };
        }
      }
    });

    render(<ChatWindow sessionId="test-session" onClose={vi.fn()} />);

    // Type a message
    const input = screen.getByPlaceholderText('Type a message…');
    fireEvent.change(input, { target: { value: 'Hello' } });

    // Submit (find the send button by data-slot or form submission)
    const form = input.closest('form');
    fireEvent.submit(form!);

    // Wait for the agent's response to appear
    await waitFor(() => {
      expect(screen.getByText('Valid message')).toBeInTheDocument();
    });
  });
});
