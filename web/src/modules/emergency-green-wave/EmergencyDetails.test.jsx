import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EmergencyDetails from './EmergencyDetails';
import * as emergencyService from '../../services/emergencyService';

vi.mock('../../services/emergencyService', () => ({
  cancelEmergency: vi.fn(),
  getAiReport: vi.fn(),
  getEmergencyById: vi.fn(),
  getRouteById: vi.fn(),
  getAiWorkflow: vi.fn(),
  proposeSignals: vi.fn(),
  approveAiWorkflow: vi.fn(),
  rejectAiWorkflow: vi.fn(),
  activateGreenWave: vi.fn(),
  completeEmergency: vi.fn(),
}));

const baseEmergency = {
  sessionId: 'session-1',
  driverId: 'driver-1',
  vehicleType: 'Ambulance',
  status: 'ACTIVE',
  selectedRouteId: null,
  createdAt: '2026-09-25T00:00:00Z',
  updatedAt: '2026-09-25T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  emergencyService.getEmergencyById.mockResolvedValue(baseEmergency);
  emergencyService.getAiReport.mockResolvedValue(null);
  emergencyService.getAiWorkflow.mockResolvedValue(null);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('EmergencyDetails lifecycle controls', () => {
  it('shows cancellation for ACTIVE and shows no-restoration outcome after cancellation', async () => {
    emergencyService.cancelEmergency.mockResolvedValue({ ...baseEmergency, status: 'CANCELLED' });
    emergencyService.getEmergencyById
      .mockResolvedValueOnce(baseEmergency)
      .mockResolvedValue({ ...baseEmergency, status: 'CANCELLED' });
    render(<EmergencyDetails emergency={baseEmergency} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel Emergency' }));
    expect(await screen.findByText('Cancelled — no signal restoration performed')).toBeInTheDocument();
    await waitFor(() => expect(emergencyService.cancelEmergency).toHaveBeenCalledWith('session-1'));
  });

  it.each(['COMPLETED', 'CANCELLED'])('does not show cancellation for %s sessions', async (status) => {
    const terminalEmergency = { ...baseEmergency, status };
    emergencyService.getEmergencyById.mockResolvedValue(terminalEmergency);
    render(<EmergencyDetails emergency={terminalEmergency} />);

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel Emergency' })).not.toBeInTheDocument());
  });

  it('polls active session details once and cleans up the timer on unmount', async () => {
    vi.useFakeTimers();
    render(<EmergencyDetails emergency={baseEmergency} />);
    await vi.advanceTimersByTimeAsync(0);
    const initialCalls = emergencyService.getEmergencyById.mock.calls.length;

    await vi.advanceTimersByTimeAsync(10000);
    expect(emergencyService.getEmergencyById.mock.calls.length).toBeGreaterThan(initialCalls);

    const callsAfterPoll = emergencyService.getEmergencyById.mock.calls.length;
    cleanup();
    await vi.advanceTimersByTimeAsync(20000);
    expect(emergencyService.getEmergencyById.mock.calls.length).toBe(callsAfterPoll);
  });
});
