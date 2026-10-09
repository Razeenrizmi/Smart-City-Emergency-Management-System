import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ResolvedHazardsView from '../pages/ResolvedHazardsView';

const resolvedPothole = {
  hazardId: 'h-r1',
  hazardType: 'POTHOLE',
  aiDetectedCategory: 'POTHOLE',
  latitude: 6.9271,
  longitude: 79.885,
  severityScore: 4,
  approvalStatus: 'RESOLVED',
  isVerified: true,
  aiConfidenceScore: 0.9,
  createdAt: '2026-01-02T10:00:00Z',
  resolvedAt: '2026-01-05T10:00:00Z',
};

const resolvedFlood = {
  hazardId: 'h-r2',
  hazardType: 'FLOODING',
  aiDetectedCategory: 'FLOODING',
  latitude: 6.1,
  longitude: 79.1,
  severityScore: 2,
  approvalStatus: 'RESOLVED',
  aiConfidenceScore: 0,
  createdAt: '2026-01-01T10:00:00Z',
  resolvedAt: null,
};

const activeHazard = {
  hazardId: 'h-a1',
  hazardType: 'DEBRIS',
  latitude: 6.5,
  longitude: 79.5,
  severityScore: 5,
  approvalStatus: 'APPROVED',
};

const sample = [resolvedPothole, resolvedFlood, activeHazard];

// CountCard renders label and value as siblings inside the same wrapper node.
const countFor = (label) => screen.getByText(label).parentElement.textContent;

describe('ResolvedHazardsView', () => {
  afterEach(() => {
    cleanup();
  });

  it('counts active and resolved hazards separately', () => {
    render(<ResolvedHazardsView hazards={sample} />);

    expect(countFor('Active Hazards')).toContain('1');
    expect(countFor('Resolved Hazards')).toContain('2');
    expect(countFor('Total Reports')).toContain('3');
  });

  it('lists resolved records and excludes active hazards', () => {
    render(<ResolvedHazardsView hazards={sample} />);

    const table = screen.getByRole('table');
    expect(within(table).getByText('POTHOLE')).toBeInTheDocument();
    expect(within(table).getByText('FLOODING')).toBeInTheDocument();
    // The active DEBRIS hazard must not appear in the resolved history table.
    expect(within(table).queryByText('DEBRIS')).toBeNull();
  });

  it('shows the resolved date when known and a dash when missing', () => {
    render(<ResolvedHazardsView hazards={sample} />);

    const table = screen.getByRole('table');
    // Pothole has an AI confidence and a resolvedAt; flood has neither.
    expect(within(table).getByText('90%')).toBeInTheDocument();
    expect(within(table).getAllByText('—')).toHaveLength(2);
  });

  it('narrows the list by text search', () => {
    render(<ResolvedHazardsView hazards={sample} />);

    fireEvent.change(screen.getByPlaceholderText(/search by type/i), { target: { value: 'flooding' } });

    const table = screen.getByRole('table');
    expect(within(table).getByText('FLOODING')).toBeInTheDocument();
    expect(within(table).queryByText('POTHOLE')).toBeNull();
    expect(screen.getByText(/showing/i).textContent).toContain('1');
  });

  it('filters by hazard type', () => {
    render(<ResolvedHazardsView hazards={sample} />);

    fireEvent.change(screen.getByLabelText(/filter by hazard type/i), { target: { value: 'POTHOLE' } });

    const table = screen.getByRole('table');
    expect(within(table).getByText('POTHOLE')).toBeInTheDocument();
    expect(within(table).queryByText('FLOODING')).toBeNull();
  });

  it('shows an empty state when there are no resolved hazards', () => {
    render(<ResolvedHazardsView hazards={[activeHazard]} />);

    expect(screen.getByText(/no resolved hazards yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
