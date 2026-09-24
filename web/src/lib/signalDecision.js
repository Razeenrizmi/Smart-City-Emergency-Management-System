const MIN_GREEN_SEC = 8;
const MAX_GREEN_SEC = 35;
const SEC_PER_VEHICLE = 1.5;
const AMBER_SEC = 3;

export function greenDurationForCount(count) {
  return Math.min(MAX_GREEN_SEC, Math.max(MIN_GREEN_SEC, Math.round(MIN_GREEN_SEC + count * SEC_PER_VEHICLE)));
}

// The busiest approach goes first, then the rest in descending order of
// demand — a simple, explainable priority rule for the test simulator.
// Works for any junction shape (roadIds can be 2 to N roads); ties keep
// the roads' original order.
export function decideSignalOrder(vehicleCountsByRoad, roadIds) {
  return [...roadIds]
    .map((direction) => ({
      direction,
      vehicleCount: vehicleCountsByRoad[direction] ?? 0,
    }))
    .sort((a, b) => b.vehicleCount - a.vehicleCount)
    .map((entry) => ({
      ...entry,
      greenSec: greenDurationForCount(entry.vehicleCount),
      amberSec: AMBER_SEC,
    }));
}
