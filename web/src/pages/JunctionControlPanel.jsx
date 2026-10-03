import { useState } from 'react';
import { useJunctionPanelData } from '../hooks/useJunctionPanelData';
import AgentStepsDetail from '../components/AgentStepsDetail';
import ManualSignalPlanForm from '../components/ManualSignalPlanForm';
import JunctionTelemetryCard from '../components/JunctionTelemetryCard';
import './JunctionControlPanel.css';

function ProposedPlanTable({ proposedPlanJson }) {
  let plan;
  try {
    plan = JSON.parse(proposedPlanJson);
  } catch {
    return null;
  }
  if (!plan?.roads?.length) return null;

  return (
    <table className="proposal-list__plan">
      <thead>
        <tr>
          <th>Road</th>
          <th>Vehicles</th>
          <th>Green</th>
        </tr>
      </thead>
      <tbody>
        {plan.roads.map((r) => (
          <tr key={r.laneLabel}>
            <td>{r.laneLabel}</td>
            <td>{r.vehicleCount}</td>
            <td>{r.greenSeconds}s</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function JunctionControlPanel() {
  const { intersections, proposals, loading, error, refetch, approveProposal, rejectProposal } =
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

  return (
    <section className="junction-panel">
      <header className="junction-panel__header">
        <h1>Junction Control Panel</h1>
        <p>Real-time camera density and signal-timing proposals, read live from the backend database.</p>
      </header>

      <ManualSignalPlanForm intersections={intersections} />

      {loading && intersections.length === 0 && proposals.length === 0 && (
        <p className="junction-panel__status">Loading junction data…</p>
      )}

      {error && (
        <p className="junction-panel__error">
          Couldn't reach the backend: {error}. Is the API running at{' '}
          {import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5017'}?
        </p>
      )}

      <section className="junction-panel__telemetry">
        <h2>Camera status</h2>
        <p className="junction-panel__section-hint">
          Live camera density per junction, same as the mobile app — click a junction to see its per-road breakdown.
        </p>
        {intersections.length === 0 ? (
          <p className="junction-panel__status">No junctions in the database yet.</p>
        ) : (
          <div className="junction-panel__telemetry-grid">
            {intersections.map((i) => (
              <JunctionTelemetryCard key={i.id} intersection={i} onDeleted={refetch} />
            ))}
          </div>
        )}
      </section>

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
                  <ProposedPlanTable proposedPlanJson={p.proposedPlanJson} />
                  <AgentStepsDetail proposalId={p.id} />
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
