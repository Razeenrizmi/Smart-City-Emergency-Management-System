import { useState, useEffect } from 'react';
import RouteInfo from './RouteInfo';
import AiWorkflowPanel from './AiWorkflowPanel';
import StatusBadge from './StatusBadge';
import { cancelEmergency, getAiReport, getEmergencyById, getRouteById } from '../../services/emergencyService';

function EmergencyDetails({ emergency }) {
  const [detailedEmergency, setDetailedEmergency] = useState(null);
  const [route, setRoute] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch detailed emergency info
        const detailed = await getEmergencyById(emergency.sessionId);
        setDetailedEmergency(detailed);
        try {
          setReport(await getAiReport(emergency.sessionId));
        } catch {
          setReport(null);
        }

        // Fetch route if selectedRouteId exists
        if (emergency.selectedRouteId) {
          try {
            const routeData = await getRouteById(emergency.selectedRouteId);
            setRoute(routeData);
          } catch (routeError) {
            console.error('Error fetching route:', routeError);
            setError('Could not load route details. The route may have been deleted.');
          }
        }
      } catch (err) {
        setError('Failed to load emergency details. Please try again.');
        console.error('Emergency details fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [emergency.sessionId, emergency.selectedRouteId]);

  if (loading) {
    return <div className="loading-state">Loading emergency details...</div>;
  }

  if (error) {
    return (
      <div className="error-state">
        <span className="error-icon">⚠️</span>
        {error}
      </div>
    );
  }

  const displayEmergency = detailedEmergency || emergency;
  const greenWave = report?.greenWave;
  const greenWaveStatus = greenWave?.status || 'NOT_STARTED';
  const isActive = displayEmergency.status === 'ACTIVE';

  const handleCancel = async () => {
    try {
      setCancelling(true);
      setError(null);
      await cancelEmergency(displayEmergency.sessionId);
      const refreshedEmergency = await getEmergencyById(displayEmergency.sessionId);
      setDetailedEmergency(refreshedEmergency);
      try {
        setReport(await getAiReport(displayEmergency.sessionId));
      } catch {
        setReport(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to cancel the emergency session.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="emergency-details">
      <section className="details-section">
        <h2>Session Information</h2>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Session ID:</span>
            <span className="info-value">{displayEmergency.sessionId}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Driver ID:</span>
            <span className="info-value">{displayEmergency.driverId}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Vehicle Type:</span>
            <span className="info-value">{displayEmergency.vehicleType}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Status:</span>
            <span className={`status-badge status-${displayEmergency.status.toLowerCase()}`}>
              {displayEmergency.status}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Created At:</span>
            <span className="info-value">
              {new Date(displayEmergency.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Updated At:</span>
            <span className="info-value">
              {new Date(displayEmergency.updatedAt).toLocaleString()}
            </span>
          </div>
          {displayEmergency.selectedRouteId && (
            <div className="info-item">
              <span className="info-label">Selected Route ID:</span>
              <span className="info-value">{displayEmergency.selectedRouteId}</span>
            </div>
          )}
        </div>
      </section>

      <section className="details-section">
        <h2>Green Wave Information</h2>
        <div className="green-wave-info">
          <div className="info-item">
            <span className="info-label">Emergency Status:</span>
            <span className={`status-badge status-${displayEmergency.status.toLowerCase()}`}>
              {displayEmergency.status}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Green Wave Status:</span>
            <StatusBadge value={greenWaveStatus} />
          </div>
          <div className="info-grid green-wave-metrics">
            <div className="info-item"><span className="info-label">Activated At</span><span className="info-value">{greenWave?.activatedAt ? new Date(greenWave.activatedAt).toLocaleString() : '—'}</span></div>
            <div className="info-item"><span className="info-label">Restored At</span><span className="info-value">{greenWave?.restoredAt ? new Date(greenWave.restoredAt).toLocaleString() : '—'}</span></div>
            <div className="info-item"><span className="info-label">Junctions</span><span className="info-value">{greenWave?.junctions?.length || 0}</span></div>
          </div>
        </div>
      </section>

      {route ? (
        <RouteInfo route={route} />
      ) : displayEmergency.selectedRouteId ? (
        <div className="info-note">
          Route details could not be loaded. The route may have been deleted.
        </div>
      ) : (
        <div className="info-note">
          No route selected for this emergency session.
        </div>
      )}

      {isActive && (
        <section className="details-section cancellation-section">
          <h2>Cancel Emergency</h2>
          <p className="info-note">
            Cancellation ends the session without restoring traffic signals.
          </p>
          <button
            className="danger-button"
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? 'Cancelling...' : 'Cancel Emergency'}
          </button>
        </section>
      )}

      {displayEmergency.status === 'CANCELLED' && (
        <section className="details-section cancellation-outcome">
          <h2>Cancellation Outcome</h2>
          <p>Cancelled — no signal restoration performed</p>
        </section>
      )}

      <AiWorkflowPanel emergency={displayEmergency} />
    </div>
  );
}

export default EmergencyDetails;
