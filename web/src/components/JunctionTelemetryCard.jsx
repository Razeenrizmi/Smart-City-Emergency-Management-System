import { useState } from 'react';
import CongestionBadge from './CongestionBadge';
import { api } from '../lib/api';
import './JunctionTelemetryCard.css';

// Read-only camera/telemetry status per junction, matching the Flutter
// mobile app's Camera Status screen — same data, same "tap to expand
// per-road breakdown" interaction, plus the same delete capability.
export default function JunctionTelemetryCard({ intersection, onDeleted }) {
  const [expanded, setExpanded] = useState(false);
  const [cameras, setCameras] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  async function handleToggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (cameras) return;
    setLoading(true);
    try {
      const data = await api.getIntersectionCameras(intersection.id);
      setCameras(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmDelete(e) {
    e.stopPropagation();
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteIntersection(intersection.id);
      onDeleted();
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  }

  return (
    <div className="junction-telemetry-card">
      <button type="button" className="junction-telemetry-card__header" onClick={handleToggle}>
        <span className="junction-telemetry-card__name">{intersection.name}</span>
        <span className="junction-telemetry-card__lanes">{intersection.laneCount} lanes</span>
        {!confirmingDelete && (
          <span
            role="button"
            tabIndex={0}
            className="junction-telemetry-card__delete"
            title="Delete junction"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmingDelete(true);
            }}
          >
            🗑
          </span>
        )}
        <span className="junction-telemetry-card__chevron">{expanded ? '▲' : '▼'}</span>
      </button>

      {confirmingDelete && (
        <div className="junction-telemetry-card__confirm" onClick={(e) => e.stopPropagation()}>
          <span>Delete this junction and all its cameras/telemetry?</span>
          <button type="button" className="junction-telemetry-card__confirm-yes" disabled={deleting} onClick={handleConfirmDelete}>
            {deleting ? 'Deleting…' : 'Yes, delete'}
          </button>
          <button type="button" className="junction-telemetry-card__confirm-no" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </button>
        </div>
      )}
      {deleteError && <p className="junction-telemetry-card__status junction-telemetry-card__status--error">{deleteError}</p>}

      {intersection.congestionLevel ? (
        <div className="junction-telemetry-card__summary">
          <span className="junction-telemetry-card__count">{intersection.totalVehicleCount} vehicles</span>
          <CongestionBadge level={intersection.congestionLevel} />
          <span className="junction-telemetry-card__timestamp">
            Updated {new Date(intersection.lastUpdated).toLocaleTimeString()} — avg lane density{' '}
            {intersection.averageLaneDensityPercent.toFixed(0)}%
          </span>
        </div>
      ) : (
        <p className="junction-telemetry-card__pending">Waiting for first camera reading…</p>
      )}

      {expanded && (
        <div className="junction-telemetry-card__breakdown">
          {loading && <p className="junction-telemetry-card__status">Loading road breakdown…</p>}
          {error && <p className="junction-telemetry-card__status junction-telemetry-card__status--error">{error}</p>}
          {cameras && cameras.length === 0 && (
            <p className="junction-telemetry-card__status">No cameras on this junction yet.</p>
          )}
          {cameras && cameras.length > 0 && (
            <ul className="junction-telemetry-card__roads">
              {cameras.map((cam) => (
                <li key={cam.cameraSensorId}>
                  <span>{cam.laneLabel}</span>
                  {cam.vehicleCount !== null ? (
                    <span className="junction-telemetry-card__road-reading">
                      {cam.vehicleCount} vehicles <CongestionBadge level={cam.congestionLevel} />
                    </span>
                  ) : (
                    <span className="junction-telemetry-card__road-reading">No reading yet</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
