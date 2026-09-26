import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Truck, Check, Ban, RefreshCw, Inbox } from 'lucide-react';
import apiClient from '../services/appClient';
import { C, card, button, badge } from '../theme';
import { priorityMeta, fmtDate } from '../workflow';

const SectionHeader = ({ icon: Icon, title, count, color, onRefresh }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
    <div style={{ padding: '8px', borderRadius: '10px', background: `${color}22`, color, display: 'flex' }}>
      <Icon size={18} />
    </div>
    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{title}</h3>
    <span style={badge(color)}>{count}</span>
    <button
      type="button"
      onClick={onRefresh}
      style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: C.textDim, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}
    >
      <RefreshCw size={13} /> Refresh
    </button>
  </div>
);

const EmptyState = ({ label }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '28px', color: C.textFaint, fontSize: '13px' }}>
    <Inbox size={22} />
    {label}
  </div>
);

const HazardCard = ({ hazard, onAction, busy }) => (
  <div style={{ ...card, padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <AlertTriangle size={15} color={hazard.severityScore >= 4 ? C.red : C.orange} />
      <strong style={{ fontSize: '14px' }}>{hazard.aiDetectedCategory || hazard.hazardType || 'Road Hazard'}</strong>
      <span style={{ ...badge(hazard.severityScore >= 4 ? C.red : C.orange), marginLeft: 'auto' }}>
        Severity {hazard.severityScore}/5
      </span>
    </div>

    <div style={{ fontSize: '12px', color: C.textDim, display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <span>{Number(hazard.latitude).toFixed(4)}, {Number(hazard.longitude).toFixed(4)}</span>
      <span>Reported {fmtDate(hazard.createdAt)}</span>
      {hazard.aiConfidenceScore > 0 && (
        <span>AI confidence {(hazard.aiConfidenceScore * 100).toFixed(0)}%</span>
      )}
    </div>

    <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
      <button
        type="button"
        disabled={busy}
        onClick={() => onAction(hazard.hazardId, 'approve')}
        style={{ ...button(C.green, busy), flex: 1, background: busy ? `${C.green}22` : C.green, color: '#0D1117', border: 'none' }}
      >
        <Check size={14} /> Approve
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onAction(hazard.hazardId, 'reject')}
        style={{ ...button(C.red, busy), flex: 1 }}
      >
        <Ban size={14} /> Reject
      </button>
    </div>
  </div>
);

const OrderCard = ({ order, onAction, busy }) => (
  <div style={{ ...card, padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Truck size={15} color={C.purple} />
      <strong style={{ fontSize: '14px' }}>{order.workerName}</strong>
      <span style={{ ...badge(priorityMeta(order.priority).color), marginLeft: 'auto' }}>
        {priorityMeta(order.priority).label}
      </span>
    </div>

    <div style={{ fontSize: '12px', color: C.textDim, display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <span>Hazard: {order.hazardType} (severity {order.severityScore}/5)</span>
      <span>{Number(order.latitude).toFixed(4)}, {Number(order.longitude).toFixed(4)}</span>
      <span>Requested by {order.assignedByName} · {fmtDate(order.createdAt)}</span>
      {order.notes && <span style={{ color: C.text, fontStyle: 'italic' }}>“{order.notes}”</span>}
    </div>

    <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
      <button
        type="button"
        disabled={busy}
        onClick={() => onAction(order.workOrderId, 'approve')}
        style={{ ...button(C.green, busy), flex: 1, background: busy ? `${C.green}22` : C.green, color: '#0D1117', border: 'none' }}
      >
        <Check size={14} /> Approve Dispatch
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onAction(order.workOrderId, 'reject')}
        style={{ ...button(C.red, busy), flex: 1 }}
      >
        <Ban size={14} /> Reject
      </button>
    </div>
  </div>
);

const PendingApprovalsView = ({ onChanged }) => {
  const [hazards, setHazards] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const [h, o] = await Promise.all([
      apiClient.get('/hazards/pending'),
      apiClient.get('/workorders/pending'),
    ]);
    setHazards(h.data?.data || []);
    setOrders(o.data?.data || []);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await load();
      } catch (err) {
        if (alive) setError(err.response?.data?.error || err.message || 'Failed to load approvals.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [load]);

  const handleRefresh = async () => {
    try {
      setError(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const act = async (kind, id, verb) => {
    setBusy(`${kind}:${id}`);
    setError(null);
    try {
      const path = kind === 'hazard' ? `/hazards/${id}/${verb}` : `/workorders/${id}/${verb}`;
      await apiClient.put(path);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Action failed.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div style={{ ...card, color: C.textDim, fontSize: '14px' }}>Loading approval queues…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {error && (
        <div style={{ background: `${C.red}18`, border: `1px solid ${C.red}55`, borderRadius: '12px', padding: '12px 16px', color: C.red, fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Section 1 — hazard reports awaiting verification */}
      <section style={card}>
        <SectionHeader icon={AlertTriangle} title="Hazard Reports — Pending Verification" count={hazards.length} color={C.orange} onRefresh={handleRefresh} />
        {hazards.length === 0 ? (
          <EmptyState label="No hazard reports awaiting approval." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {hazards.map((h) => (
              <HazardCard key={h.hazardId} hazard={h} busy={busy === `hazard:${h.hazardId}`} onAction={(id, verb) => act('hazard', id, verb)} />
            ))}
          </div>
        )}
      </section>

      {/* Section 2 — dispatch requests awaiting sign-off */}
      <section style={card}>
        <SectionHeader icon={Truck} title="Dispatch Requests — Pending Sign-off" count={orders.length} color={C.purple} onRefresh={handleRefresh} />
        {orders.length === 0 ? (
          <EmptyState label="No dispatch requests awaiting sign-off." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {orders.map((o) => (
              <OrderCard key={o.workOrderId} order={o} busy={busy === `order:${o.workOrderId}`} onAction={(id, verb) => act('order', id, verb)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default PendingApprovalsView;
