import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HazardMap from '../components/HazardMap';
import App from '../App';

// ─── jsdom has no real map engine: stub leaflet + react-leaflet ─────────────
vi.mock('react-leaflet', async () => {
  const React = await import('react');
  const h = React.createElement;

  return {
    MapContainer: ({ children }) => h('div', { 'data-testid': 'map-container' }, children),
    TileLayer: () => null,
    Marker: ({ children, position }) =>
      h('div', { 'data-testid': 'marker', 'data-position': position.join(',') }, children),
    Popup: ({ children }) => h('div', { 'data-testid': 'popup' }, children),
    Polyline: () => null,
    CircleMarker: () => null,
    useMap: () => ({
      invalidateSize: () => {},
      fitBounds: () => {},
      setView: () => {},
    }),
  };
});

vi.mock('leaflet', () => ({
  default: {
    icon: () => ({}),
    divIcon: () => ({}),
    latLngBounds: () => ({ extend: () => {}, pad: () => {} }),
    Marker: { prototype: { options: {} } },
  },
}));

// ─── App error-path mocks (used only by the last test) ──────────────────────
vi.mock('../services/auth', () => ({
  getSession: () => ({ token: 'test-token', user: { role: 'MUNICIPAL_OFFICER', fullName: 'Test Officer' } }),
  clearSession: vi.fn(),
}));

const mockGet = vi.fn();
vi.mock('../services/appClient', () => ({
  default: { get: (...args) => mockGet(...args) },
}));

const approved = {
  hazardId: 'h-approved',
  latitude: 6.9271,
  longitude: 79.885,
  severityScore: 3,
  approvalStatus: 'APPROVED',
  hazardType: 'POTHOLE',
  isVerified: true,
};
const pending = {
  hazardId: 'h-pending',
  latitude: 6.1,
  longitude: 79.1,
  severityScore: 1,
  approvalStatus: 'PENDING',
  hazardType: 'POTHOLE',
};
const resolved = {
  hazardId: 'h-resolved',
  latitude: 6.2,
  longitude: 79.2,
  severityScore: 2,
  approvalStatus: 'RESOLVED',
};
const noCoordinates = {
  hazardId: 'h-no-coords',
  latitude: 0,
  longitude: 0,
  severityScore: 2,
  approvalStatus: 'APPROVED',
};

describe('HazardMap', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders one Leaflet marker per renderable hazard', () => {
    render(<HazardMap hazards={[approved, pending]} />);

    const markers = screen.getAllByTestId('marker');
    expect(markers).toHaveLength(2);
    expect(markers[0]).toHaveAttribute('data-position', '6.9271,79.885');
  });

  it('formats popup coordinates, severity and status', () => {
    render(<HazardMap hazards={[approved]} />);

    expect(screen.getByText('6.9271, 79.8850')).toBeInTheDocument();
    expect(screen.getByText('3/5')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('View in Google Maps')).toBeInTheDocument();
  });

  it('renders a clean map for an empty hazard list', () => {
    render(<HazardMap hazards={[]} />);

    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.queryAllByTestId('marker')).toHaveLength(0);
  });

  it('filters out RESOLVED hazards and hazards without coordinates', () => {
    render(<HazardMap hazards={[resolved, noCoordinates, approved]} />);

    expect(screen.getAllByTestId('marker')).toHaveLength(1);
  });
});

describe('App hazard map — API error state', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows the connection error screen when the hazards API fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network down'));

    render(<App />);

    expect(await screen.findByText('Connection Error')).toBeInTheDocument();
    expect(screen.getByText('Network down')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry connection/i })).toBeInTheDocument();
  });
});
