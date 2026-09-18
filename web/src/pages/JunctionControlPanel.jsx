import { useState } from 'react';
import { useJunctionPanelData } from '../hooks/useJunctionPanelData';
import CongestionBadge from '../components/CongestionBadge';
import './JunctionControlPanel.css';

export default function JunctionControlPanel() {
  const { junctions, proposals, loading, error, approveProposal, rejectProposal } = useJunctionPanelData();
  const [actioningId, setActioningId] = useState(null);

  async function handleApprove(id) {
    setActioningId(id);
    try {
      await approveProposal(id);
    } finally {
      setActioningId(null);
    }
  }

  async function handleReject(id) {
    setActioningId(id);
    try {
      await rejectProposal(id);
    } finally {
      setActioningId(null);
    }
  }

  return (
    <section className="junction-panel">
      <header className="junction-panel__header">
        <h1>Junction Control Panel</h1>
        <p>Real-time camera density and signal-adjustment proposals, read live from the backend database.</p>
      </header>

      {loading && junctions.length === 0 && <p className="junction-panel__status">Loading junctions…</p>}

      {error && (
        <p className="junction-panel__error">
          Couldn't reach the backend: {error}. Is the API running at{' '}
          {import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5017'}?
        </p>
      )}

      {!loading && !error && junctions.length === 0 && (
        <p className="junction-panel__status">No junctions in the database yet.</p>
      )}

      {junctions.length > 0 && (
        <div className="junction-panel__grid">
          {junctions.map((j) => (
            <div key={j.id} className="junction-card">
              <div className="junction-card__header">
                <span className="junction-card__name">{j.junctionName}</span>
                <span className={`junction-card__signal junction-card__signal--${j.currentSignalState?.toLowerCase()}`}>
                  {j.currentSignalState}
                </span>
              </div>
              {j.latestTelemetry ? (
                <div className="junction-card__telemetry">
                  <span className="junction-card__count">{j.latestTelemetry.detectedVehicleCount} vehicles</span>
                  <CongestionBadge level={j.latestTelemetry.congestionLevel} />
                  <span className="junction-card__timestamp">
                    Updated {new Date(j.latestTelemetry.recordedAt).toLocaleTimeString()}
                  </span>
                </div>
              ) : (
                <p className="junction-card__pending">Waiting for first camera reading…</p>
              )}
            </div>
          ))}
        </div>
      )}

      <section className="junction-panel__proposals">
        <h2>Pending signal-adjustment proposals</h2>
        {proposals.length === 0 ? (
          <p className="junction-panel__status">No proposals waiting for approval right now.</p>
        ) : (
          <ul className="proposal-list">
            {proposals.map((p) => (
              <li key={p.id} className="proposal-list__item">
                <div>
                  <strong>{p.junctionName}</strong>
                  <span className="proposal-list__detail">
                    {' '}
                    — extend green by {p.proposedGreenExtensionSec}s
                  </span>
                </div>
                <div className="proposal-list__actions">
                  <button
                    type="button"
                    className="proposal-list__approve"
                    disabled={actioningId === p.id}
                    onClick={() => handleApprove(p.id)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="proposal-list__reject"
                    disabled={actioningId === p.id}
                    onClick={() => handleReject(p.id)}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
