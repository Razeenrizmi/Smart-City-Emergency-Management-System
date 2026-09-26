import { useEffect, useState } from 'react';
import { X, Wrench, AlertCircle, MapPin } from 'lucide-react';
import apiClient from '../services/appClient';
import { C, button, input, badge } from '../theme';
import { PRIORITIES, priorityMeta, titleCase } from '../workflow';

const AssignWorkerModal = ({ hazard, onClose, onCreated }) => {
  const [workers, setWorkers] = useState([]);
  const [workerId, setWorkerId] = useState('');
  const [notes, setNotes] = useState('');
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [priority, setPriority] = useState(() => {
    const sev = hazard?.severityScore || 1;
    if (sev >= 5) return 'CRITICAL';
    if (sev >= 4) return 'HIGH';
    if (sev >= 3) return 'MEDIUM';
    return 'LOW';
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiClient.get('/workers');
        if (!alive) return;
        const list = (res.data?.data || []).filter((w) => w.status !== 'INACTIVE');
        setWorkers(list);
        const preferred = list.find((w) => w.status === 'AVAILABLE') || list[0];
        if (preferred) setWorkerId(preferred.workerId);
      } catch (err) {
        if (alive) setError(err.response?.data?.error || err.message || 'Failed to load workers.');
      } finally {
        if (alive) setLoadingWorkers(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!workerId || saving) return;

    setSaving(true);
    setError(null);
    try {
      await apiClient.post('/workorders', {
        hazardId: hazard.hazardId,
        workerId,
        priority,
        notes: notes.trim() || null,
      });
      onCreated?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to create dispatch request.');
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        style={{
          width: '100%', maxWidth: '480px', background: C.surface,
          border: `1px solid ${C.border}`, borderRadius: '18px', padding: '24px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ padding: '9px', borderRadius: '11px', background: `${C.purple}22`, color: C.purple, display: 'flex' }}>
            <Wrench size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Assign Repair Work</h3>
            <div style={{ fontSize: '12px', color: C.textDim }}>
              {hazard.aiDetectedCategory || hazard.hazardType} · severity {hazard.severityScore || 1}/5
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textDim, cursor: 'pointer', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: C.textDim, fontSize: '12px', marginBottom: '18px' }}>
          <MapPin size={13} />
          {Number(hazard.latitude).toFixed(4)}, {Number(hazard.longitude).toFixed(4)}
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: `${C.red}18`, border: `1px solid ${C.red}55`, borderRadius: '10px', padding: '10px 12px', color: C.red, fontSize: '13px', marginBottom: '16px' }}>
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <label style={{ display: 'block', color: C.textDim, fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>WORKER</label>
        <select
          id="assign-worker-select"
          value={workerId}
          onChange={(e) => setWorkerId(e.target.value)}
          disabled={loadingWorkers || workers.length === 0}
          style={{ ...input, marginBottom: '16px', cursor: 'pointer' }}
        >
          {loadingWorkers && <option value="">Loading workers…</option>}
          {!loadingWorkers && workers.length === 0 && <option value="">No workers available — add one first</option>}
          {workers.map((w) => (
            <option key={w.workerId} value={w.workerId}>
              {w.fullName} — {titleCase(w.specialty)} ({w.status}{w.activeJobs ? `, ${w.activeJobs} active` : ''})
            </option>
          ))}
        </select>

        <label style={{ display: 'block', color: C.textDim, fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>PRIORITY</label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {PRIORITIES.map((p) => {
            const meta = priorityMeta(p);
            const active = priority === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                style={{
                  ...badge(meta.color),
                  cursor: 'pointer',
                  padding: '6px 12px',
                  background: active ? meta.color : `${meta.color}1A`,
                  color: active ? '#0D1117' : meta.color,
                  border: `1px solid ${meta.color}`,
                }}
              >
                {meta.label}
              </button>
            );
          })}
        </div>

        <label style={{ display: 'block', color: C.textDim, fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>NOTES (OPTIONAL)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="e.g. Carry cold-mix asphalt, road closure required"
          style={{ ...input, resize: 'vertical', marginBottom: '22px' }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" onClick={onClose} style={button(C.textDim)}>
            Cancel
          </button>
          <button
            type="submit"
            id="assign-worker-submit"
            disabled={saving || !workerId}
            style={{ ...button(C.purple, saving || !workerId), background: saving || !workerId ? `${C.purple}22` : C.purple, color: '#fff', border: 'none' }}
          >
            <Wrench size={14} />
            {saving ? 'Creating request…' : 'Create Dispatch Request'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AssignWorkerModal;
