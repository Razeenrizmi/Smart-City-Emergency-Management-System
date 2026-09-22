import JunctionList from './JunctionList';

function RouteInfo({ route }) {
  return (
    <section className="details-section">
      <h2>Selected Route</h2>
      <div className="route-info">
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Route Name:</span>
            <span className="info-value">{route.routeName}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Start Location:</span>
            <span className="info-value">{route.startLocation}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Destination:</span>
            <span className="info-value">{route.destination}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Distance:</span>
            <span className="info-value">{route.distanceKm} km</span>
          </div>
          <div className="info-item">
            <span className="info-label">Estimated Time:</span>
            <span className="info-value">{route.estimatedTimeMinutes} minutes</span>
          </div>
          <div className="info-item">
            <span className="info-label">Traffic Level:</span>
            <span className="info-value">{route.trafficLevel}</span>
          </div>
        </div>
      </div>

      <JunctionList junctions={route.junctions} />
    </section>
  );
}

export default RouteInfo;
