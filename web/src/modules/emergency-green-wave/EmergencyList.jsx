import StatusBadge from './StatusBadge';

function shortId(value) {
  return value ? `${value.slice(0, 8)}...` : '—';
}

function routeNameFor(emergency, routes) {
  return routes?.find((route) => route.routeId === emergency.selectedRouteId)?.routeName
    || (emergency.selectedRouteId ? shortId(emergency.selectedRouteId) : 'No route');
}

function EmergencyList({
  emergencies,
  onSelect,
  loading,
  emptyMessage,
  routes = [],
  compact = false,
  workflows = {},
}) {
  if (loading && emergencies.length === 0) {
    return <div className="loading-state">Loading emergency sessions...</div>;
  }

  if (emergencies.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  if (compact) {
    return (
      <div className="history-table-wrap">
        <table className="history-table">
          <thead>
            <tr><th>Status</th><th>Vehicle</th><th>Route</th><th>Date</th><th>Action</th></tr>
          </thead>
          <tbody>
            {emergencies.map((emergency) => (
              <tr key={emergency.sessionId}>
                <td><StatusBadge value={emergency.status} /></td>
                <td>{emergency.vehicleType}</td>
                <td>{routeNameFor(emergency, routes)}</td>
                <td>{new Date(emergency.createdAt).toLocaleString()}</td>
                <td><button className="text-button" type="button" onClick={() => onSelect(emergency)}>Details</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="emergency-list">
      {emergencies.map((emergency) => {
        const workflow = workflows[emergency.sessionId];
        const greenWaveStatus = workflow?.signalExecutionPerformed ? 'ACTIVE / RESTORED' : 'NOT ACTIVE';
        return (
          <article key={emergency.sessionId} className="emergency-card">
            <div className="emergency-card-header">
              <StatusBadge value={emergency.status} />
              <span className="session-id">{shortId(emergency.sessionId)}</span>
            </div>
            <div className="emergency-card-body">
              <div className="emergency-field"><span className="field-label">Vehicle</span><span className="field-value">{emergency.vehicleType}</span></div>
              <div className="emergency-field"><span className="field-label">Driver</span><span className="field-value">{shortId(emergency.driverId)}</span></div>
              <div className="emergency-field"><span className="field-label">Route</span><span className="field-value">{routeNameFor(emergency, routes)}</span></div>
              <div className="emergency-field"><span className="field-label">Green Wave</span><span className="field-value">{greenWaveStatus}</span></div>
              <div className="emergency-field"><span className="field-label">Created</span><span className="field-value">{new Date(emergency.createdAt).toLocaleString()}</span></div>
            </div>
            {workflow?.approvalStatus === 'PENDING_APPROVAL' && <div className="card-alert">AI proposal awaiting approval</div>}
            <button className="primary-button card-action" type="button" onClick={() => onSelect(emergency)}>View Details</button>
          </article>
        );
      })}
    </div>
  );
}

export default EmergencyList;
