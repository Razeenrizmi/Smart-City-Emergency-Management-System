export const MIN_ROADS = 2;
export const MAX_ROADS = 6;
export const DEFAULT_ROAD_COUNT = 4;

const COMPASS_IDS = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
const COMPASS_LABELS = {
  NORTH: 'North approach',
  EAST: 'East approach',
  SOUTH: 'South approach',
  WEST: 'West approach',
};

// The classic 4-way crossroad keeps compass names since that's the most
// common and most intuitive case; any other road count (a T-junction, a
// 5- or 6-way intersection) falls back to plain "Road N" labels rather
// than guessing at compass positions that don't map cleanly to arbitrary
// counts.
export function generateRoadIds(count) {
  if (count === 4) return [...COMPASS_IDS];
  return Array.from({ length: count }, (_, i) => `ROAD_${i + 1}`);
}

export function roadLabel(roadId) {
  if (COMPASS_LABELS[roadId]) return COMPASS_LABELS[roadId];
  const n = roadId.split('_')[1];
  return `Road ${n}`;
}
