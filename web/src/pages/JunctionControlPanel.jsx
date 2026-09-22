import { useState } from 'react';
import { useJunctionPanelData } from '../hooks/useJunctionPanelData';
import CongestionBadge from '../components/CongestionBadge';
import SimulatedJunctionSummary from '../components/SimulatedJunctionSummary';
import './JunctionControlPanel.css';

export default function JunctionControlPanel() {
  const { intersections, proposals, loading, error, approveProposal, rejectProposal, deleteIntersection } =
    useJunctionPanelData();
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

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete "${name}"? This also removes its cameras, telemetry, and proposal history.`)) {
      return;
    }
    setActioningId(id);
    try {
      await deleteIntersection(id);
    } finally {
      setActioningId(null);
    }
  }

  return (
    <section className="junction-panel">
      <header className="junction-panel__header">
        <h1>Junction Control Panel</h1>
        <p>Real-time camera density and signal-timing proposals, read live from the backend database.</p>
      </header>

      <section className="junction-panel__live-sim">
        <h2>Signal Test Simulator — live preview</h2>
        <p className="junction-panel__section-hint">
          Whatever's currently running in the Signal Test Simulator, shown here directly from the browser — use
          "Save to Junction Control Panel" there once you're happy with it to persist it below.
        </p>
        <SimulatedJunctionSummary />
      </section>

      <h2 className="junction-panel__section-title">Saved junctions (from the database)</h2>

      {loading && intersections.length === 0 && <p className="junction-panel__status">Loading intersections…</p>}

      {error && (
        <p className="junction-panel__error">
          Couldn't reach the backend: {error}. Is the API running at{' '}
          {import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5017'}?
        </p>
      )}

      {!loading && !error && intersections.length === 0 && (
        <p className="junction-panel__status">No intersections in the database yet.</p>
      )}

      {intersections.length > 0 && (
        <div className="junction-panel__grid">
          {intersections.map((i) => (
            <div key={i.id} className="junction-card">
              <div className="junction-card__header">
                <span className="junction-card__name">{i.name}</span>
                <span className="junction-card__lanes">{i.laneCount} lanes</span>
              </div>
              <button
                type="button"
                className="junction-card__delete"
                disabled={actioningId === i.id}
                onClick={() => handleDelete(i.id, i.name)}
              >
                Delete road
              </button>
              {i.congestionLevel ? (
                <div className="junction-card__telemetry">
                  <span className="junction-card__count">{i.totalVehicleCount} vehicles</span>
                  <CongestionBadge level={i.congestionLevel} />
                  <span className="junction-card__timestamp">
                    Updated {new Date(i.lastUpdated).toLocaleTimeString()} — avg lane density{' '}
                    {i.averageLaneDensityPercent.toFixed(0)}%
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
        <h2>Pending signal-timing proposals</h2>
        {proposals.length === 0 ? (
          <p className="junction-panel__status">No proposals waiting for approval right now.</p>
        ) : (
          <ul className="proposal-list">
            {proposals.map((p) => (
              <li key={p.id} className="proposal-list__item">
                <div>
                  <strong>{p.intersectionName}</strong>
                  <p className="proposal-list__detail">{p.justification}</p>
                  <span className="proposal-list__safety">Safety check: {p.safetyCheckStatus}</span>
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
