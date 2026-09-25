import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AiWorkflowPanel from './AiWorkflowPanel';
import * as emergencyService from '../../services/emergencyService';

vi.mock('../../services/emergencyService', () => ({
  activateGreenWave: vi.fn(),
  approveAiWorkflow: vi.fn(),
  completeEmergency: vi.fn(),
  getAiReport: vi.fn(),
  getAiWorkflow: vi.fn(),
  proposeSignals: vi.fn(),
  rejectAiWorkflow: vi.fn(),
}));

const activeEmergency = { sessionId: 'session-1', status: 'ACTIVE' };

const workflow = {
  objective: 'Emergency Green Wave signal action proposal',
  workflowStatus: 'COMPLETED',
  proposalStatus: 'PROPOSED',
  approvalStatus: 'PENDING_APPROVAL',
  isValid: true,
  handoffReady: false,
  proposedActions: [],
  validationNotes: ['VALIDATION PASSED'],
  updatedAt: '2026-09-25T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  emergencyService.getAiReport.mockResolvedValue(null);
  emergencyService.getAiWorkflow.mockResolvedValue(workflow);
  emergencyService.approveAiWorkflow.mockResolvedValue({});
  emergencyService.activateGreenWave.mockResolvedValue({});
  emergencyService.completeEmergency.mockResolvedValue({});
});
afterEach(cleanup);

describe('AiWorkflowPanel', () => {
  it('shows approval controls for a valid pending proposal', async () => {
    render(<AiWorkflowPanel emergency={activeEmergency} />);

    expect(await screen.findByRole('button', { name: 'Approve proposal' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reject proposal' })).toBeInTheDocument();
  });

  it('approves a proposal and then enables activation', async () => {
    render(<AiWorkflowPanel emergency={activeEmergency} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve proposal' }));

    await waitFor(() => expect(emergencyService.approveAiWorkflow).toHaveBeenCalledWith(
      'session-1',
      { operatorId: null, notes: null },
    ));

    emergencyService.getAiWorkflow.mockResolvedValue({
      ...workflow,
      approvalStatus: 'APPROVED',
      proposalStatus: 'APPROVED',
      handoffReady: true,
      approvedBy: 'operator',
      approvedAt: '2026-09-25T00:00:00Z',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh workflow' }));
    expect(await screen.findByRole('button', { name: 'Activate Green Wave' })).toBeInTheDocument();
  });

  it('enables completion for an active green wave and reports service errors', async () => {
    emergencyService.getAiWorkflow.mockResolvedValue({
      ...workflow,
      approvalStatus: 'APPROVED',
      proposalStatus: 'APPROVED',
      handoffReady: true,
      signalExecutionPerformed: true,
    });
    emergencyService.activateGreenWave.mockRejectedValue(new Error('Activation failed'));

    render(<AiWorkflowPanel emergency={activeEmergency} />);
    expect(await screen.findByRole('button', { name: 'Complete emergency and restore signals' })).toBeInTheDocument();

    emergencyService.completeEmergency.mockRejectedValue(new Error('Completion failed'));
    fireEvent.click(screen.getByRole('button', { name: 'Complete emergency and restore signals' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Completion failed');
  });
});
