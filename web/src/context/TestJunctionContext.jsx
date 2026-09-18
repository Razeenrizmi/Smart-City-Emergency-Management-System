import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_ROAD_COUNT, generateRoadIds, roadLabel } from '../lib/directions';
import { deriveCongestionLevel } from '../lib/congestion';
import { loadDetectionModel, scanVideoForVehicles } from '../lib/vehicleDetection';
import { decideSignalOrder } from '../lib/signalDecision';
import { TestJunctionContext } from './testJunctionContextValue';

const emptyRoadState = (roadId) => ({
  name: roadLabel(roadId),
  file: null,
  fileName: null,
  previewUrl: null,
  status: 'empty', // empty | ready | scanning | scanned | error
  vehicleCount: null,
  congestionLevel: null,
  thumbnail: null,
  error: null,
});

const buildInitialDirections = (roadIds) =>
  roadIds.reduce((acc, roadId) => ({ ...acc, [roadId]: emptyRoadState(roadId) }), {});

// Mounted once at the app shell (see App.jsx) rather than inside the Signal
// Test Simulator page, so the scan results and the automatic light cycle
// survive navigating away — the Junction Control Panel reads the same
// state to show a live summary of whichever junction was last tested.
export function TestJunctionProvider({ children }) {
  const [roadCount, setRoadCountState] = useState(DEFAULT_ROAD_COUNT);
  const roadIds = useMemo(() => generateRoadIds(roadCount), [roadCount]);

  const [directions, setDirections] = useState(() => buildInitialDirections(roadIds));
  const [modelStatus, setModelStatus] = useState('idle');
  const [scanning, setScanning] = useState(false);
  const [decision, setDecision] = useState(null);
  const [activeStep, setActiveStep] = useState(null); // { direction, phase, vehicleCount }

  const cycleTokenRef = useRef(0);
  const timeoutRef = useRef(null);
  const directionsRef = useRef(directions);
  // startCycle needs to trigger a fresh background scan once the last
  // road's turn begins, and that scan needs to call startCycle() when it
  // completes — a ref breaks that circular dependency without pulling
  // the scan function into startCycle's own useCallback deps.
  const scanAllBackgroundRef = useRef(null);
  // The background re-scan for the next round is kicked off as soon as
  // the last road's turn starts, so the ML work overlaps with that
  // road's own green+amber instead of adding wait time after the cycle
  // ends. These two refs reconcile whichever finishes second: the scan
  // or the cycle's own natural end.
  const nextOrderReadyRef = useRef(null);
  const cycleFinishedRef = useRef(false);
  // startCycle recurses into itself once a round finishes — going
  // through a ref instead of calling the const binding directly avoids
  // referencing `startCycle` from inside its own not-yet-finished
  // declaration.
  const startCycleRef = useRef(null);

  useEffect(() => {
    directionsRef.current = directions;
  }, [directions]);

  useEffect(
    () => () => {
      clearTimeout(timeoutRef.current);
      Object.values(directionsRef.current).forEach((d) => {
        if (d.previewUrl) URL.revokeObjectURL(d.previewUrl);
      });
    },
    [],
  );

  const stopSimulation = useCallback(() => {
    cycleTokenRef.current += 1;
    clearTimeout(timeoutRef.current);
    setActiveStep(null);
    // Any in-flight background scan is now for a cycle that no longer
    // exists — drop its result instead of letting a later cycle
    // mistakenly consume stale counts.
    nextOrderReadyRef.current = null;
    cycleFinishedRef.current = false;
  }, []);

  const startCycle = useCallback((order) => {
    cycleTokenRef.current += 1;
    const token = cycleTokenRef.current;

    const runPhase = (index, phase) => {
      if (cycleTokenRef.current !== token) return;
      const entry = order[index];
      const durationMs = (phase === 'GREEN' ? entry.greenSec : entry.amberSec) * 1000;
      // phaseEndsAt lets the UI show a live countdown, so the full
      // duration being honored is directly visible/verifiable rather
      // than something you have to take on faith.
      setActiveStep({
        direction: entry.direction,
        phase,
        vehicleCount: entry.vehicleCount,
        phaseEndsAt: Date.now() + durationMs,
      });
      // Start re-scanning for the next round as soon as the last road's
      // turn begins, not after it ends — the scan then runs alongside
      // that road's own green+amber instead of the cycle sitting idle
      // waiting for it afterwards.
      if (index === order.length - 1 && phase === 'GREEN') {
        scanAllBackgroundRef.current?.(token);
      }
      timeoutRef.current = setTimeout(() => {
        if (cycleTokenRef.current !== token) return;
        if (phase === 'GREEN') {
          runPhase(index, 'AMBER');
        } else if (index === order.length - 1) {
          // Every road has had a turn. The re-scan kicked off above may
          // have already finished (fast scan / long last phase) — if so
          // its result is sitting in nextOrderReadyRef, so use it right
          // away. Otherwise mark the cycle as finished and let the
          // still-running background scan start the next cycle itself
          // the moment it completes.
          if (nextOrderReadyRef.current) {
            const nextOrder = nextOrderReadyRef.current;
            nextOrderReadyRef.current = null;
            setDecision(nextOrder);
            startCycleRef.current?.(nextOrder);
          } else {
            cycleFinishedRef.current = true;
          }
        } else {
          runPhase(index + 1, 'GREEN');
        }
      }, durationMs);
    };

    runPhase(0, 'GREEN');
  }, []);

  useEffect(() => {
    startCycleRef.current = startCycle;
  }, [startCycle]);

  // Changing the junction shape invalidates any footage already uploaded —
  // road identities themselves change (e.g. going from 4 to 3 roads isn't
  // "drop the last one", it's a different junction), so start clean.
  const setRoadCount = useCallback(
    (count) => {
      stopSimulation();
      setDecision(null);
      setDirections((prev) => {
        Object.values(prev).forEach((d) => {
          if (d.previewUrl) URL.revokeObjectURL(d.previewUrl);
        });
        return buildInitialDirections(generateRoadIds(count));
      });
      setRoadCountState(count);
    },
    [stopSimulation],
  );

  const setDirectionFile = useCallback(
    (direction, file) => {
      stopSimulation();
      setDecision(null);
      setDirections((prev) => {
        const previous = prev[direction];
        if (previous.previewUrl) URL.revokeObjectURL(previous.previewUrl);
        return {
          ...prev,
          [direction]: {
            ...emptyRoadState(direction),
            name: previous.name, // keep any custom name across re-uploads
            file,
            fileName: file.name,
            previewUrl: URL.createObjectURL(file),
            status: 'ready',
          },
        };
      });
    },
    [stopSimulation],
  );

  const renameRoad = useCallback((roadId, name) => {
    setDirections((prev) => ({
      ...prev,
      [roadId]: { ...prev[roadId], name },
    }));
  }, []);

  // Shared by the manual "Scan all" button and the automatic background
  // re-scan — scans every road's footage sequentially (so the model isn't
  // asked to run inference on several clips at once in the main thread)
  // and returns the decided signal order.
  const runScanPass = useCallback(async () => {
    setScanning(true);
    setModelStatus((s) => (s === 'ready' ? s : 'loading-runtime'));

    try {
      await loadDetectionModel(setModelStatus);

      const counts = {};
      for (const direction of roadIds) {
        setDirections((prev) => ({
          ...prev,
          [direction]: { ...prev[direction], status: 'scanning', error: null },
        }));

        try {
          const result = await scanVideoForVehicles(directions[direction].file);
          counts[direction] = result.vehicleCount;
          setDirections((prev) => ({
            ...prev,
            [direction]: {
              ...prev[direction],
              status: 'scanned',
              vehicleCount: result.vehicleCount,
              congestionLevel: deriveCongestionLevel(result.vehicleCount),
              thumbnail: result.thumbnail,
            },
          }));
        } catch (err) {
          setDirections((prev) => ({
            ...prev,
            [direction]: { ...prev[direction], status: 'error', error: err.message },
          }));
          throw err;
        }
      }

      return decideSignalOrder(counts, roadIds);
    } finally {
      setScanning(false);
    }
  }, [directions, roadIds]);

  const scanAll = useCallback(async () => {
    if (roadIds.some((d) => !directions[d].file)) return;

    stopSimulation();
    try {
      const order = await runScanPass();
      setDecision(order);
      startCycle(order);
    } catch {
      // Per-road error is already recorded on that road's state; nothing
      // further to surface globally.
    }
  }, [directions, roadIds, runScanPass, startCycle, stopSimulation]);

  // Kicked off from inside startCycle as soon as the last road's turn
  // begins (see runPhase above) — deliberately does NOT call
  // stopSimulation, since the current cycle should keep running its
  // countdown undisturbed while this scans in the background. `token` is
  // the cycle that requested this scan; if a stop/reset/new scan bumps
  // cycleTokenRef before this resolves, its result is discarded instead
  // of leaking into whatever runs next.
  const scanAllInBackground = useCallback(
    async (token) => {
      if (roadIds.some((d) => !directions[d].file)) return;
      try {
        const order = await runScanPass();
        if (cycleTokenRef.current !== token) return;
        if (cycleFinishedRef.current) {
          cycleFinishedRef.current = false;
          setDecision(order);
          startCycleRef.current?.(order);
        } else {
          nextOrderReadyRef.current = order;
        }
      } catch {
        // Per-road error is already recorded on that road's state. If the
        // cycle has already ended waiting for this, it now just stays on
        // its last phase — same fallback behavior as a failed manual scan.
      }
    },
    [directions, roadIds, runScanPass],
  );

  useEffect(() => {
    scanAllBackgroundRef.current = scanAllInBackground;
  }, [scanAllInBackground]);

  const resetAll = useCallback(() => {
    stopSimulation();
    setDecision(null);
    setDirections((prev) => {
      Object.values(prev).forEach((d) => {
        if (d.previewUrl) URL.revokeObjectURL(d.previewUrl);
      });
      return buildInitialDirections(roadIds);
    });
  }, [roadIds, stopSimulation]);

  const allFilesUploaded = roadIds.every((d) => Boolean(directions[d].file));
  const allScanned = roadIds.every((d) => directions[d].status === 'scanned');
  const hasAnyScan = roadIds.some((d) => directions[d].status === 'scanned');
  const anyErrored = roadIds.some((d) => directions[d].status === 'error');

  // Scan automatically as soon as every road has footage — no need to
  // click "Scan all" for the common case. Guarded by !decision so a
  // manual "Stop cycle" (which clears activeStep but leaves the last
  // decision standing) doesn't immediately auto-resume, and by
  // !anyErrored so a failed scan doesn't retry itself forever; the
  // button stays available for those cases.
  useEffect(() => {
    if (allFilesUploaded && !scanning && !activeStep && !decision && !anyErrored) {
      // Deferred a tick so this doesn't synchronously setState from
      // within the effect body itself — scanAll's first line is
      // setScanning(true).
      const id = setTimeout(() => scanAll(), 0);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [directions, allFilesUploaded, scanning, activeStep, decision, anyErrored, scanAll]);

  const value = {
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
    hasAnyScan,
    setDirectionFile,
    renameRoad,
    scanAll,
    resetAll,
    stopSimulation,
  };

  return <TestJunctionContext.Provider value={value}>{children}</TestJunctionContext.Provider>;
}
