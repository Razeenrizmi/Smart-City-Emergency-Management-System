import { useEffect, useState } from 'react';
import { MAX_ROADS, MIN_ROADS } from '../lib/directions';
import DirectionUploadCard from '../components/DirectionUploadCard';
import { useTestJunction } from '../context/useTestJunction';
import './SignalTestSimulator.css';

const MODEL_STATUS_LABEL = {
  idle: 'Detection model not loaded yet',
  'loading-runtime': 'Loading detection runtime…',
  'loading-model': 'Downloading vehicle-detection model…',
  ready: 'Detection model ready',
  error: 'Detection model failed to load',
};

const ROAD_COUNT_OPTIONS = Array.from(
  { length: MAX_ROADS - MIN_ROADS + 1 },
  (_, i) => MIN_ROADS + i,
);

const PHASE_EMOJI = { GREEN: '🟢', AMBER: '🟡' };

export default function SignalTestSimulator() {
  const {
    roadCount,
    roadIds,
    setRoadCount,
    directions,
    modelStatus,
    scanning,
    decision,
    activeStep,
    allFilesUploaded,
    junctionOff,
    toggleJunctionOff,
    autoScanEnabled,
    toggleAutoScan,
    setDirectionFile,
    renameRoad,
    scanAll,
    resetAll,
    stopSimulation,
  } = useTestJunction();

  const phaseFor = (direction) => (activeStep?.direction === direction ? activeStep.phase : null);

  // A live countdown makes the phase timing directly verifiable on
  // screen — you can watch the seconds actually count down to zero,
  // rather than having to take "the full duration is honored" on faith.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!activeStep) return undefined;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [activeStep]);
  const secondsRemaining = activeStep
    ? Math.max(0, Math.ceil((activeStep.phaseEndsAt - now) / 1000))
    : null;

  return (
    <section className="signal-sim">
      <header className="signal-sim__header">
        <h1>Signal Test Simulator</h1>
      </header>

      <div className="signal-sim__control-bar">
        <label className="signal-sim__road-count">
          Roads at this junction
          <select
            value={roadCount}
            onChange={(e) => setRoadCount(Number(e.target.value))}
            disabled={scanning}
          >
            {ROAD_COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <p className="signal-sim__model-status">{MODEL_STATUS_LABEL[modelStatus]}</p>

        <button
          type="button"
          className="signal-sim__scan-btn"
          onClick={scanAll}
          disabled={!allFilesUploaded || scanning}
        >
          {scanning ? 'Scanning…' : `Scan all ${roadCount} & start simulation`}
        </button>

        <button
          type="button"
          className={`signal-sim__autoscan-btn ${autoScanEnabled ? 'is-on' : ''}`}
          onClick={toggleAutoScan}
        >
          Auto-scan: {autoScanEnabled ? 'ON' : 'OFF'}
        </button>

        {(decision || allFilesUploaded) && (
          <button type="button" className="signal-sim__reset-btn" onClick={resetAll}>
            Reset
          </button>
        )}
        {activeStep && (
          <button type="button" className="signal-sim__reset-btn" onClick={stopSimulation}>
            Stop cycle
          </button>
        )}
        <button
          type="button"
          className={`signal-sim__off-btn ${junctionOff ? 'is-off' : ''}`}
          onClick={toggleJunctionOff}
        >
          {junctionOff ? 'Turn junction ON' : 'Turn junction OFF'}
        </button>
      </div>

      {junctionOff && (
        <p className="signal-sim__off-banner">
          Junction is OFF — every light is flashing yellow and the cycle is paused.
        </p>
      )}

      {!allFilesUploaded && (
        <p className="signal-sim__hint">
          Upload footage for all {roadCount} road{roadCount === 1 ? '' : 's'} to scan
          {autoScanEnabled ? ' — scanning starts automatically once every road has footage.' : '.'}
        </p>
      )}
      {allFilesUploaded && !autoScanEnabled && !decision && (
        <p className="signal-sim__hint">Auto-scan is off — click "Scan all" above when you're ready.</p>
      )}

      {decision && (
        <ol className="signal-sim__decision">
          {decision.map((entry, i) => {
            const isActive = activeStep?.direction === entry.direction;
            return (
              <li key={entry.direction} className={isActive ? 'is-active' : ''}>
                {i + 1}. {directions[entry.direction].name} — {entry.vehicleCount} vehicles (green{' '}
                {entry.greenSec}s)
                {isActive && secondsRemaining !== null && (
                  <span className="signal-sim__countdown">
                    {PHASE_EMOJI[activeStep.phase]} {secondsRemaining}s left
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <div className="signal-sim__cards">
        {roadIds.map((roadId) => (
          <DirectionUploadCard
            key={roadId}
            state={directions[roadId]}
            phase={phaseFor(roadId)}
            off={junctionOff}
            onFileSelected={(file) => setDirectionFile(roadId, file)}
            onRename={(name) => renameRoad(roadId, name)}
            disabled={scanning}
          />
        ))}
      </div>
    </section>
  );
}
