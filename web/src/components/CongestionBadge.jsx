import { CONGESTION_LEVELS } from '../lib/congestion';
import './CongestionBadge.css';

export default function CongestionBadge({ level }) {
  const meta = CONGESTION_LEVELS[level] ?? CONGESTION_LEVELS.LOW;
  return (
    <span className="congestion-badge" style={{ '--badge-color': meta.color }}>
      <span className="congestion-badge__dot" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
