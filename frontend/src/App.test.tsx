import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';
import { agentsApi } from './lib/agentsApi';

// Mock agentsApi since it is called in useEffect on mount
vi.mock('./lib/agentsApi', () => ({
  agentsApi: {
    listAgents: vi.fn().mockResolvedValue({ data: [] }),
    listEnvironments: vi.fn().mockResolvedValue({ data: [] }),
    listSessions: vi.fn().mockResolvedValue({ data: [] }),
    listCredentialVaults: vi.fn().mockResolvedValue({ data: [] }),
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

  it('renders the App component and shows the messages view by default', async () => {
    render(<App />);

    // There are two "New Session" buttons (header + content area)
    const newSessionButtons = screen.getAllByText('New Session');
    expect(newSessionButtons.length).toBeGreaterThan(0);

    // Wait for async effects to resolve (e.g. agentsApi calls)
    await waitFor(() => {
      // The default rail is 'messages', so "Recent Sessions" heading should be visible
      const heading = screen.getByRole('heading', { name: 'Recent Sessions' });
      expect(heading).toBeInTheDocument();
    });

    // No sessions yet message should appear
    expect(screen.getByText('No sessions yet')).toBeInTheDocument();
  });

  it('calls createSession with agent and environment when dialog is submitted', async () => {
    // Setup agents and environments so New Session is enabled
    vi.mocked(agentsApi.listAgents).mockResolvedValueOnce({
      data: [{ id: 'agent-1', name: 'Test Agent', description: '', created_at: '', updated_at: '' }],
    });
    vi.mocked(agentsApi.listEnvironments).mockResolvedValueOnce({
      data: [{ id: 'env-1' }],
    });

    // Setup createSession to fail (still calls through to the API)
    const createSessionMock = vi.mocked(agentsApi.createSession).mockRejectedValueOnce(new Error('Network error'));

    render(<App />);

    // Wait for one of the "New Session" buttons to become enabled
    const buttons = await screen.findAllByRole('button', { name: /New Session/i });
    const button = buttons[0];
    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });

    // Click "New Session" — this opens the session creation dialog
    fireEvent.click(button);

    // Find and click the "Create session" submit button inside the dialog
    const createBtn = await screen.findByRole('button', { name: /Create session/i });
    fireEvent.click(createBtn);

    // Verify agentsApi.createSession was called with correct args
    await waitFor(() => {
      expect(createSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({ agent: 'agent-1', environment_id: 'env-1' }),
      );
    });
  });

  it('adds a new connection, supports keyboard submit, and rejects duplicate names', async () => {
    const getMcpToolsMock = vi.mocked(agentsApi.getMcpTools).mockImplementation(async (provider: string) => {
      if (provider === 'Slack') {
        return {
          read_only: [{ name: 'slack.read', status: 'allow' }],
          write_delete: [],
        };
      }

      if (provider === 'Acme') {
        throw new Error('Unknown provider');
      }

      return { read_only: [], write_delete: [] };
    });

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Setup and API' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Connections' }));

    await screen.findByText('slack.read');

    fireEvent.click(screen.getByRole('button', { name: /Add connection/i }));
    const input = screen.getByLabelText(/Connection Name/i);
    const form = input.closest('form') as HTMLFormElement;
    const addButton = within(form).getByRole('button', { name: 'Add connection' });

    expect(addButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'Acme' } });
    expect(addButton).not.toBeDisabled();
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Acme' })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.queryByText('slack.read')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add connection/i }));
    const duplicateInput = screen.getByLabelText(/Connection Name/i);
    const duplicateForm = duplicateInput.closest('form') as HTMLFormElement;
    fireEvent.change(duplicateInput, { target: { value: 'acme' } });
    fireEvent.click(within(duplicateForm).getByRole('button', { name: 'Add connection' }));

    expect(screen.getAllByRole('button', { name: 'Acme' })).toHaveLength(1);
    expect(getMcpToolsMock).toHaveBeenCalledWith('Acme');
  });
});
