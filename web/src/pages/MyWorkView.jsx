import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Play, Check, MapPin, HardHat, AlertCircle, ExternalLink, Inbox } from 'lucide-react';
import apiClient from '../services/appClient';
import { C, card, button, badge } from '../theme';
import { statusMeta, priorityMeta, fmtDate } from '../workflow';

const Summary = ({ orders }) => {
  const counts = [
    { label: 'To Start', value: orders.filter((o) => o.status === 'ASSIGNED').length, color: C.blue },
    { label: 'In Progress', value: orders.filter((o) => o.status === 'IN_PROGRESS').length, color: C.orange },
    { label: 'Completed', value: orders.filter((o) => o.status === 'COMPLETED').length, color: C.green },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
      {counts.map((c) => (
        <div key={c.label} style={{ ...card, padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '10px', height: '38px', borderRadius: '6px', background: c.color }} />
          <div>
            <div style={{ color: C.textDim, fontSize: '12px' }}>{c.label}</div>
            <div style={{ color: '#fff', fontSize: '22px', fontWeight: 700 }}>{c.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

const JobCard = ({ order, busy, onAction }) => {
  const meta = statusMeta(order.status);
  const canStart = order.status === 'ASSIGNED';
  const canComplete = order.status === 'IN_PROGRESS';

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <HardHat size={16} color={C.purple} />
        <strong style={{ fontSize: '15px' }}>{order.hazardType}</strong>
        <span style={{ ...badge(meta.color), marginLeft: 'auto' }}>{meta.label}</span>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <span style={badge(order.severityScore >= 4 ? C.red : C.orange)}>Severity {order.severityScore}/5</span>
        <span style={badge(priorityMeta(order.priority).color)}>{priorityMeta(order.priority).label} priority</span>
      </div>

      <div style={{ fontSize: '12px', color: C.textDim, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MapPin size={12} />
          {Number(order.latitude).toFixed(4)}, {Number(order.longitude).toFixed(4)}
        </span>
        <span>Assigned by {order.assignedByName} · {fmtDate(order.createdAt)}</span>
        {order.completedAt && <span>Completed {fmtDate(order.completedAt)}</span>}
      </div>

      {order.notes && (
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '10px 12px', fontSize: '12px', color: C.text, fontStyle: 'italic' }}>
          “{order.notes}”
        </div>
      )}

      <a
        href={`https://www.google.com/maps/search/?api=1&query=${order.latitude},${order.longitude}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: C.blue, fontSize: '12px', textDecoration: 'none', fontWeight: 600 }}
      >
        <ExternalLink size={12} /> Open location in Google Maps
      </a>

      {(canStart || canComplete) && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
          {canStart && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction(order, 'IN_PROGRESS')}
              style={{ ...button(C.orange, busy), flex: 1, background: busy ? `${C.orange}22` : C.orange, color: '#0D1117', border: 'none' }}
            >
              <Play size={14} /> Start Work
            </button>
          )}
          {canComplete && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction(order, 'COMPLETED')}
              style={{ ...button(C.green, busy), flex: 1, background: busy ? `${C.green}22` : C.green, color: '#0D1117', border: 'none' }}
            >
              <Check size={14} /> Mark Completed
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const MyWorkView = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const res = await apiClient.get('/workorders/mine');
    setOrders(res.data?.data || []);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await load();
      } catch (err) {
        if (alive) setError(err.response?.data?.error || err.message || 'Failed to load your assigned work.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [load]);

  const act = async (order, status) => {
    setBusyId(order.workOrderId);
    setError(null);
    try {
      await apiClient.put(`/workorders/${order.workOrderId}/status`, { status });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to update the job.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div style={{ ...card, color: C.textDim, fontSize: '14px' }}>Loading your assigned work…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ padding: '8px', borderRadius: '10px', background: `${C.purple}22`, color: C.purple, display: 'flex' }}>
          <ClipboardList size={18} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>My Repair Jobs</h3>
          <div style={{ fontSize: '12px', color: C.textDim }}>
            Work assigned to you. Start a job when you arrive, mark it completed when the repair is done.
          </div>
        </div>
      </div>

      <Summary orders={orders} />

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: `${C.red}18`, border: `1px solid ${C.red}55`, borderRadius: '12px', padding: '12px 16px', color: C.red, fontSize: '13px' }}>
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {orders.length === 0 ? (
        <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '40px', color: C.textFaint }}>
          <Inbox size={26} />
          <span style={{ fontSize: '14px' }}>No jobs assigned to you yet.</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {orders.map((o) => (
            <JobCard key={o.workOrderId} order={o} busy={busyId === o.workOrderId} onAction={act} />
          ))}
        </div>
      )}

      <div style={{ fontSize: '12px', color: C.textFaint }}>
        You only see and can update jobs assigned to you.
      </div>
    </div>
  );
};

export default MyWorkView;
