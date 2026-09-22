function EmergencyList({ emergencies, onSelect, loading, emptyMessage }) {
  if (loading && emergencies.length === 0) {
    return <div className="loading-state">Loading emergency sessions...</div>;
  }

  if (emergencies.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <div className="emergency-list">
      {emergencies.map((emergency) => (
        <div
          key={emergency.sessionId}
          className="emergency-card"
          onClick={() => onSelect(emergency)}
        >
          <div className="emergency-card-header">
            <span className={`status-badge status-${emergency.status.toLowerCase()}`}>
              {emergency.status}
            </span>
            <span className="session-id">{emergency.sessionId.slice(0, 8)}...</span>
          </div>
          <div className="emergency-card-body">
            <div className="emergency-field">
              <span className="field-label">Vehicle Type:</span>
              <span className="field-value">{emergency.vehicleType}</span>
            </div>
            <div className="emergency-field">
              <span className="field-label">Driver ID:</span>
              <span className="field-value">{emergency.driverId.slice(0, 8)}...</span>
            </div>
            {emergency.selectedRouteId && (
              <div className="emergency-field">
                <span className="field-label">Route ID:</span>
                <span className="field-value">{emergency.selectedRouteId.slice(0, 8)}...</span>
              </div>
            )}
            <div className="emergency-field">
              <span className="field-label">Created:</span>
              <span className="field-value">
                {new Date(emergency.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default EmergencyList;
