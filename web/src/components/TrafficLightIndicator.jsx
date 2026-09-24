import './TrafficLightIndicator.css';

// phase: 'GREEN' | 'AMBER' | null (null = idle/red-by-default, matches a
// real controller's fail-safe state before a decision has been made).
// off: the whole junction's controller is manually disabled — every road
// shows a blinking yellow lamp (the real-world fail-safe/caution signal
// for a junction with no active controller), not a static dark light.
export default function TrafficLightIndicator({ phase, size = 'md', off = false }) {
  return (
    <div
      className={`traffic-light traffic-light--${size}`}
      role="img"
      aria-label={off ? 'Signal: OFF (flashing yellow)' : `Signal: ${phase ?? 'RED'}`}
    >
      <span className={`traffic-light__lamp traffic-light__lamp--red ${!off && !phase ? 'is-on' : ''}`} />
      <span
        className={`traffic-light__lamp traffic-light__lamp--amber ${off ? 'is-blinking' : phase === 'AMBER' ? 'is-on' : ''}`}
      />
      <span className={`traffic-light__lamp traffic-light__lamp--green ${!off && phase === 'GREEN' ? 'is-on' : ''}`} />
    </div>
  );
}
