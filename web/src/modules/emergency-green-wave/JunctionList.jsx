function JunctionList({ junctions }) {
  if (!junctions || junctions.length === 0) {
    return <div className="info-note">No junctions available for this route.</div>;
  }

  const getSignalColor = (signalState) => {
    switch (signalState?.toUpperCase()) {
      case 'GREEN':
        return '#22c55e';
      case 'RED':
        return '#ef4444';
      case 'YELLOW':
        return '#eab308';
      default:
        return '#6b7280';
    }
  };

  return (
    <div className="junction-list">
      <h3>Route Junctions</h3>
      <div className="junctions-container">
        {junctions.map((junction) => (
          <div key={junction.junctionId} className="junction-item">
            <div 
              className="junction-sequence"
              style={{ backgroundColor: getSignalColor(junction.currentSignalState) }}
            >
              {junction.sequenceNumber}
            </div>
            <div className="junction-details">
              <div className="junction-name">{junction.junctionName}</div>
              <div className="junction-signal">
                <span className="signal-label">Signal:</span>
                <span 
                  className="signal-state"
                  style={{ color: getSignalColor(junction.currentSignalState) }}
                >
                  {junction.currentSignalState}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default JunctionList;
