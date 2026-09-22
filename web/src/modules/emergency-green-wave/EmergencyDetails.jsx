import { useState, useEffect } from 'react';
import RouteInfo from './RouteInfo';
import { getEmergencyById, getRouteById } from '../../services/emergencyService';

function EmergencyDetails({ emergency }) {
  const [detailedEmergency, setDetailedEmergency] = useState(null);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch detailed emergency info
        const detailed = await getEmergencyById(emergency.sessionId);
        setDetailedEmergency(detailed);

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
            <span className="info-value neutral">
              Not available from monitoring API
            </span>
          </div>
          <p className="info-note">
            Note: The current monitoring API does not expose active SignalPreemptionLog state. 
            Green Wave activation status cannot be determined from available data.
          </p>
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
    </div>
  );
}

export default EmergencyDetails;
