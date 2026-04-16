import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AutomationsList } from './AutomationsList';
import { agentsApi } from '../../lib/agentsApi';

vi.mock('../../lib/agentsApi', async () => {
  const actual = await vi.importActual<typeof import('../../lib/agentsApi')>('../../lib/agentsApi');
  return {
    ...actual,
    agentsApi: {
      ...actual.agentsApi,
      listScheduleConfigs: vi.fn(),
      createScheduleConfig: vi.fn(),
      updateScheduleConfig: vi.fn(),
      deleteScheduleConfig: vi.fn(),
    },
  };
});

describe('AutomationsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(agentsApi.listScheduleConfigs).mockResolvedValue({ data: [] });
    vi.mocked(agentsApi.createScheduleConfig).mockResolvedValue({});
  });

  it('renders targeted JSON validation errors in create flow', async () => {
    render(<AutomationsList agents={[{ id: 'agent-1', name: 'Agent One', description: '', created_at: '', updated_at: '' }]} />);

    await waitFor(() => {
      expect(agentsApi.listScheduleConfigs).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: /new routine/i }));

    fireEvent.change(screen.getByPlaceholderText('{"message": "Check for new PRs"}'), { target: { value: '{' } });
    fireEvent.click(screen.getByRole('button', { name: /create routine/i }));
    expect(await screen.findByText(/invalid json in payload/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('{"message": "Check for new PRs"}'), { target: { value: '' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'github' } });
    fireEvent.change(screen.getByPlaceholderText('owner/repo'), { target: { value: 'owner/repo' } });
    
    // Select some events
    const pushCheckbox = screen.getByLabelText(/push/i);
    fireEvent.click(pushCheckbox);
    
    fireEvent.click(screen.getByRole('button', { name: /create routine/i }));

    await waitFor(() => {
      expect(agentsApi.createScheduleConfig).toHaveBeenCalledWith(expect.objectContaining({
        trigger_type: 'github',
        github_repo: 'owner/repo',
        github_events: ['push']
      }));
    });
  });
});
