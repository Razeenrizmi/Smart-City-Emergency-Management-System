// Mirrors the derivation the backend will apply when writing
// junction_camera_telemetry.congestion_level from detected_vehicle_count.
export const CONGESTION_LEVELS = {
  LOW: { label: 'Low', color: '#22c55e' },
  MODERATE: { label: 'Moderate', color: '#eab308' },
  HIGH: { label: 'High', color: '#f97316' },
  SEVERE: { label: 'Severe', color: '#ef4444' },
};

export function deriveCongestionLevel(vehicleCount) {
  if (vehicleCount >= 45) return 'SEVERE';
  if (vehicleCount >= 30) return 'HIGH';
  if (vehicleCount >= 15) return 'MODERATE';
  return 'LOW';
}
