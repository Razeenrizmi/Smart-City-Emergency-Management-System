import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import './FaultReports.css';

// The web side of the mobile Camera Status screen's "Report fault"
// button — every camera an inspector has flagged, so someone at HQ can
// see and resolve it. Read from the same SensorFaultReports table
// mobile writes to.
export default function FaultReports() {
  const [reports, setReports] = useState([]);
  const [status, setStatus] = useState('open'); // open | resolved | all
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);

  const refetch = useCallback(async () => {
    try {
      const data = await api.getFaultReports(status);
      setReports(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    // Deferred a tick so this doesn't synchronously setState from within
    // the effect body itself.
    const id = setTimeout(() => {
      setLoading(true);
      refetch();
    }, 0);
    const pollId = setInterval(refetch, 5000);
    return () => {
      clearTimeout(id);
      clearInterval(pollId);
    };
  }, [refetch]);

  async function handleResolve(id) {
    setResolvingId(id);
    try {
      await api.resolveFaultReport(id);
      await refetch();
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <section className="fault-reports">
      <header className="fault-reports__header">
        <h1>Camera Fault Reports</h1>
        <p>Faults flagged by traffic inspectors from the mobile Camera Status app.</p>
      </header>

      <div className="fault-reports__tabs">
        {['open', 'resolved', 'all'].map((s) => (
          <button
            key={s}
            type="button"
            className={`fault-reports__tab ${status === s ? 'is-active' : ''}`}
            onClick={() => setStatus(s)}
          >
            {s === 'open' ? 'Open' : s === 'resolved' ? 'Resolved' : 'All'}
          </button>
        ))}
      </div>

      {loading && reports.length === 0 && <p className="fault-reports__status">Loading…</p>}

      {error && (
        <p className="fault-reports__error">
          Couldn't reach the backend: {error}. Is the API running at{' '}
          {import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5017'}?
        </p>
      )}

      {!loading && !error && reports.length === 0 && (
        <p className="fault-reports__status">No {status === 'all' ? '' : status} fault reports.</p>
      )}

      {reports.length > 0 && (
        <ul className="fault-reports__list">
          {reports.map((r) => (
            <li key={r.id} className={`fault-reports__item fault-reports__item--${r.status.toLowerCase()}`}>
              <div>
                <strong>
                  {r.intersectionName} — {r.laneLabel}
                </strong>
                <p className="fault-reports__detail">{r.description}</p>
                <span className="fault-reports__meta">
                  Reported {new Date(r.reportedAt).toLocaleString()}
                  {r.resolvedAt && ` — Resolved ${new Date(r.resolvedAt).toLocaleString()}`}
                </span>
              </div>
              {r.status === 'OPEN' && (
                <button
                  type="button"
                  className="fault-reports__resolve"
                  disabled={resolvingId === r.id}
                  onClick={() => handleResolve(r.id)}
                >
                  Mark resolved
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
