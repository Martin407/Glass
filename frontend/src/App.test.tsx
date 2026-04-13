import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';
import { agentsApi } from './lib/agentsApi';

// Mock agentsApi since it is called in useEffect on mount
vi.mock('./lib/agentsApi', () => ({
  agentsApi: {
    listAgents: vi.fn().mockResolvedValue({ data: [] }),
    getMcpConnections: vi.fn().mockResolvedValue({ connections: [] }),
    getMcpTools: vi.fn().mockResolvedValue({ read_only: [], write_delete: [] }),
    createSession: vi.fn(),
  }
}));

// Mock the chat window component since it is deeply nested and not the focus of this test
vi.mock('./components/ChatWindow', () => ({
  ChatWindow: () => <div data-testid="mock-chat-window">Chat Window</div>
}));

describe('App Component', () => {
  beforeEach(() => {
    vi.stubGlobal('console', { ...console, error: vi.fn() });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the App component with Slack provider selected by default', async () => {
    render(<App />);

    // Check for the new session button
    expect(screen.getByText('New Session')).toBeInTheDocument();

    // Wait for async effects to resolve (e.g. agentsApi calls)
    await waitFor(() => {
      // Look for the Slack title in the main area (it's inside an h1)
      const heading = screen.getByRole('heading', { name: 'Slack' });
      expect(heading).toBeInTheDocument();
    });

    // Also check for standard tool sections
    expect(screen.getByText(/READ-ONLY TOOLS/i)).toBeInTheDocument();
    expect(screen.getByText(/WRITE\/DELETE TOOLS/i)).toBeInTheDocument();
  });

  it('logs an error when session creation fails', async () => {
    // Setup agents mock so the button is not disabled
    vi.mocked(agentsApi.listAgents).mockResolvedValueOnce({
      data: [{ id: 'agent-1', name: 'Test Agent' }]
    });

    // Setup createSession to fail
    const mockError = new Error('Network error');
    const createSessionMock = vi.mocked(agentsApi.createSession).mockRejectedValueOnce(mockError);

    render(<App />);

    // Wait for the button to become enabled
    const button = await screen.findByRole('button', { name: /New Session/i });
    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });

    // Click the button
    fireEvent.click(button);

    // Verify agentsApi.createSession was called
    await waitFor(() => {
      expect(createSessionMock).toHaveBeenCalledWith({ agent: 'agent-1' });
    });

    // Verify console.error was called by logApiError
    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Failed to create session', mockError);
    });
  });
});
