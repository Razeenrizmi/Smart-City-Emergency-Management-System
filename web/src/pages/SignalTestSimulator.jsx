import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MAX_ROADS, MIN_ROADS } from '../lib/directions';
import DirectionUploadCard from '../components/DirectionUploadCard';
import { useTestJunction } from '../context/useTestJunction';
import { api } from '../lib/api';
import './SignalTestSimulator.css';

const LINK_STORAGE_KEYS = {
  id: 'srms.linkedJunctionId',
  name: 'srms.linkedJunctionName',
  on: 'srms.autoSaveOn',
};

function loadLinkState() {
  try {
    return {
      id: localStorage.getItem(LINK_STORAGE_KEYS.id) || null,
      name: localStorage.getItem(LINK_STORAGE_KEYS.name) || null,
      on: localStorage.getItem(LINK_STORAGE_KEYS.on) === 'true',
    };
  } catch {
    return { id: null, name: null, on: false };
  }
}

function saveLinkState(id, name, on) {
  try {
    if (id) localStorage.setItem(LINK_STORAGE_KEYS.id, id);
    else localStorage.removeItem(LINK_STORAGE_KEYS.id);
    if (name) localStorage.setItem(LINK_STORAGE_KEYS.name, name);
    else localStorage.removeItem(LINK_STORAGE_KEYS.name);
    localStorage.setItem(LINK_STORAGE_KEYS.on, String(on));
  } catch {
    // Convenience only — auto-save still works for this session even if
    // the link can't be remembered across a reload.
  }
}

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
    allScanned,
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

  // Once linked, every completed scan (the initial one and every
  // automatic re-scan after a full cycle) is pushed to the same real
  // junction — first as a create, then as updates — instead of needing a
  // manual save click each time.
  const [link, setLink] = useState(() => loadLinkState());
  // idle | syncing | synced | error
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncError, setSyncError] = useState(null);

  const syncToJunction = useCallback(async () => {
    if (!decision) return;
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      const roads = decision.map((entry) => ({
        name: directions[entry.direction].name,
        vehicleCount: entry.vehicleCount,
        greenSec: entry.greenSec,
      }));
      if (link.id) {
        await api.updateSimulationIntersection(link.id, roads);
        setSyncStatus('synced');
      } else if (link.name) {
        const created = await api.saveSimulationAsIntersection(link.name, roads);
        setLink((prev) => {
          const next = { ...prev, id: created.id };
          saveLinkState(next.id, next.name, next.on);
          return next;
        });
        setSyncStatus('synced');
      }
    } catch (err) {
      setSyncStatus('error');
      setSyncError(err.message);
    }
  }, [decision, directions, link.id, link.name]);

  function handleToggleAutoSave() {
    if (link.on) {
      setLink((prev) => {
        const next = { ...prev, on: false };
        saveLinkState(next.id, next.name, next.on);
        return next;
      });
      return;
    }

    let { name } = link;
    if (!name) {
      const defaultName = `Test Junction — ${new Date().toLocaleString()}`;
      name = window.prompt('Name this junction — future scans will automatically update it:', defaultName);
      if (!name) return; // cancelled
    }
    setLink((prev) => {
      const next = { ...prev, name, on: true };
      saveLinkState(next.id, next.name, next.on);
      return next;
    });
  }

  // Fires whenever a fresh decision is computed while linked — the first
  // time (no id yet) this creates the junction, every time after that it
  // updates the same one and raises a new proposal with the fresh plan.
  useEffect(() => {
    if (!link.on || !decision) return undefined;
    // Deferred a tick so this doesn't synchronously setState from within
    // the effect body itself — syncToJunction's first line is
    // setSyncStatus('syncing').
    const id = setTimeout(() => {
      syncToJunction();
    }, 0);
    return () => clearTimeout(id);
  }, [link.on, decision, syncToJunction]);

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

        {(decision || allScanned) && (
          <button type="button" className="signal-sim__reset-btn" onClick={resetAll}>
            Reset
          </button>
        )}
        {activeStep && (
          <button type="button" className="signal-sim__reset-btn" onClick={stopSimulation}>
            Stop cycle
          </button>
        )}
        {allScanned && (
          <button
            type="button"
            className={`signal-sim__save-btn ${link.on ? 'is-linked' : ''}`}
            onClick={handleToggleAutoSave}
          >
            {link.on
              ? syncStatus === 'syncing'
                ? 'Syncing…'
                : `Auto-saving to "${link.name}" (click to pause)`
              : 'Auto-save to Junction Control Panel'}
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

      {link.on && syncStatus === 'synced' && (
        <p className="signal-sim__save-success">
          Synced. <Link to="/junctions">View it on the Junction Control Panel</Link> — it'll keep updating
          automatically after every scan.
        </p>
      )}
      {syncStatus === 'error' && <p className="signal-sim__error">Couldn't sync: {syncError}</p>}

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
