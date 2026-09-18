import './TrafficLightIndicator.css';

// phase: 'GREEN' | 'AMBER' | null (null = idle/red-by-default, matches a
// real controller's fail-safe state before a decision has been made).
export default function TrafficLightIndicator({ phase, size = 'md' }) {
  return (
    <div className={`traffic-light traffic-light--${size}`} role="img" aria-label={`Signal: ${phase ?? 'RED'}`}>
      <span className={`traffic-light__lamp traffic-light__lamp--red ${phase ? '' : 'is-on'}`} />
      <span className={`traffic-light__lamp traffic-light__lamp--amber ${phase === 'AMBER' ? 'is-on' : ''}`} />
      <span className={`traffic-light__lamp traffic-light__lamp--green ${phase === 'GREEN' ? 'is-on' : ''}`} />
    </div>
  );
}
