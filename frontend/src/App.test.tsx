import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';

// Mock agentsApi since it is called in useEffect on mount
vi.mock('./lib/agentsApi', () => ({
  agentsApi: {
    listAgents: vi.fn().mockResolvedValue({ data: [] }),
    getMcpConnections: vi.fn().mockResolvedValue({ connections: [] }),
    getMcpTools: vi.fn().mockResolvedValue({ read_only: [], write_delete: [] }),
  }
}));

// Mock the chat window component since it is deeply nested and not the focus of this test
vi.mock('./components/ChatWindow', () => ({
  ChatWindow: () => <div data-testid="mock-chat-window">Chat Window</div>
}));

describe('App Component', () => {
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
});
