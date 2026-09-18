import { Link } from 'react-router-dom';
import { useTestJunction } from '../context/useTestJunction';
import CongestionBadge from './CongestionBadge';
import TrafficLightIndicator from './TrafficLightIndicator';
import './SimulatedJunctionSummary.css';

const PENDING_LABEL = {
  empty: 'No footage',
  ready: 'Ready to scan',
  scanning: 'Scanning…',
  error: 'Scan failed',
};

// Read-only traffic summary for whichever junction was last tested in the
// Signal Test Simulator — sourced from real scanned footage via
// TestJunctionContext, not the mock live-telemetry feed the rest of this
// panel uses.
export default function SimulatedJunctionSummary() {
  const { roadIds, directions, activeStep, allScanned, scanning, hasAnyScan } = useTestJunction();

  if (!hasAnyScan) {
    return (
      <div className="sim-summary sim-summary--empty">
        <div>
          <h3>Test junction — no footage scanned yet</h3>
          <p>Upload CCTV footage for every road in the Signal Test Simulator to see its traffic summary here.</p>
        </div>
        <Link to="/signal-test" className="sim-summary__link">
          Go to Signal Test Simulator
        </Link>
      </div>
    );
  }

  return (
    <div className="sim-summary">
      <div className="sim-summary__header">
        <div>
          <h3>Test Junction — Camera Simulator</h3>
          <p>
            {scanning
              ? 'Scanning in progress…'
              : allScanned
                ? activeStep
                  ? `Currently green: ${directions[activeStep.direction].name}`
                  : 'Simulation stopped'
                : 'Waiting for all roads to be scanned'}
          </p>
        </div>
        <Link to="/signal-test" className="sim-summary__link">
          Manage in Signal Test Simulator
        </Link>
      </div>

      <div className="sim-summary__grid">
        {roadIds.map((direction) => {
          const state = directions[direction];
          const phase = activeStep?.direction === direction ? activeStep.phase : null;
          return (
            <div key={direction} className="sim-summary__direction">
              <div className="sim-summary__direction-header">
                <span>{state.name}</span>
                <TrafficLightIndicator phase={phase} size="sm" />
              </div>
              {state.status === 'scanned' ? (
                <div className="sim-summary__stats">
                  <span className="sim-summary__count">{state.vehicleCount} vehicles</span>
                  <CongestionBadge level={state.congestionLevel} />
                </div>
              ) : (
                <span className="sim-summary__pending">{PENDING_LABEL[state.status]}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
