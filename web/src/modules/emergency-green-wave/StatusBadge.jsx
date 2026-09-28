function formatLabel(value) {
  if (!value) return '—';
  return String(value).replaceAll('_', ' ');
}

function StatusBadge({ value, kind }) {
  const text = formatLabel(value);
  const key = String(value || kind || 'unknown').toLowerCase().replaceAll(' ', '-');
  return <span className={`status-badge status-${key}`}>{text}</span>;
}

export default StatusBadge;
