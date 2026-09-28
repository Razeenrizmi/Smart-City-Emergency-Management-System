import { useCallback, useEffect, useState } from 'react';
import { Users, Plus, Pencil, Trash2, X, AlertCircle, HardHat, KeyRound } from 'lucide-react';
import apiClient from '../services/appClient';
import { C, card, button, badge, input } from '../theme';
import { SPECIALTIES, WORKER_STATUSES, titleCase } from '../workflow';

const STATUS_COLOR = { AVAILABLE: C.green, BUSY: C.orange, INACTIVE: C.textDim };

const blankWorker = { fullName: '', specialty: 'ROAD_REPAIR', phone: '', email: '', status: 'AVAILABLE', username: '', password: '' };

const labelStyle = { display: 'block', color: C.textDim, fontSize: '12px', fontWeight: 600, marginBottom: '6px' };

const WorkerForm = ({ initial, onClose, onSaved }) => {
  const [form, setForm] = useState(() => ({ ...blankWorker, ...(initial || {}), password: '' }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const isEdit = Boolean(initial?.workerId);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (saving || !form.fullName.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        specialty: form.specialty,
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        status: form.status,
        username: form.username?.trim() || null,
        password: form.password || null,
      };
      if (isEdit) await apiClient.put(`/workers/${initial.workerId}`, payload);
      else await apiClient.post('/workers', payload);
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save worker.');
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} style={{ width: '100%', maxWidth: '440px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '18px', padding: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ padding: '9px', borderRadius: '11px', background: `${C.blue}22`, color: C.blue, display: 'flex' }}>
            <HardHat size={18} />
          </div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, flex: 1 }}>{isEdit ? 'Edit Worker' : 'Add Municipal Worker'}</h3>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textDim, cursor: 'pointer', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: `${C.red}18`, border: `1px solid ${C.red}55`, borderRadius: '10px', padding: '10px 12px', color: C.red, fontSize: '13px', marginBottom: '16px' }}>
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <label style={labelStyle}>FULL NAME</label>
        <input value={form.fullName} onChange={set('fullName')} placeholder="e.g. Nimal Perera" style={{ ...input, marginBottom: '14px' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label style={labelStyle}>SPECIALTY</label>
            <select value={form.specialty} onChange={set('specialty')} style={{ ...input, cursor: 'pointer' }}>
              {SPECIALTIES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>STATUS</label>
            <select value={form.status} onChange={set('status')} style={{ ...input, cursor: 'pointer' }}>
              {WORKER_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </select>
          </div>
        </div>

        <label style={labelStyle}>PHONE</label>
        <input value={form.phone || ''} onChange={set('phone')} placeholder="+94 71 234 5678" style={{ ...input, marginBottom: '14px' }} />

        <label style={labelStyle}>EMAIL</label>
        <input value={form.email || ''} onChange={set('email')} placeholder="worker@srms.local" style={{ ...input, marginBottom: '18px' }} />

        {/* Worker login — lets this worker sign in and manage their own jobs */}
        <div style={{ border: `1px solid ${C.border}`, borderRadius: '12px', padding: '14px', marginBottom: '22px', background: C.bg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: C.purple, fontSize: '12px', fontWeight: 700 }}>
            <KeyRound size={14} />
            WORKER LOGIN
          </div>
          <p style={{ margin: '0 0 12px', color: C.textFaint, fontSize: '11px', lineHeight: 1.5 }}>
            The worker signs in with these credentials to see and update only the jobs assigned to them.
          </p>

          <label style={labelStyle}>USERNAME</label>
          <input value={form.username || ''} onChange={set('username')} placeholder="e.g. nimal" autoComplete="off" style={{ ...input, marginBottom: '12px' }} />

          <label style={labelStyle}>{isEdit ? 'NEW PASSWORD (LEAVE BLANK TO KEEP)' : 'PASSWORD'}</label>
          <input type="password" value={form.password || ''} onChange={set('password')} placeholder="••••••••" autoComplete="new-password" style={input} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" onClick={onClose} style={button(C.textDim)}>Cancel</button>
          <button type="submit" disabled={saving || !form.fullName.trim()} style={{ ...button(C.blue, saving || !form.fullName.trim()), background: saving || !form.fullName.trim() ? `${C.blue}22` : C.blue, color: '#fff', border: 'none' }}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Worker'}
          </button>
        </div>
      </form>
    </div>
  );
};

const MunicipalWorkersView = () => {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | {} for add | worker for edit
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const res = await apiClient.get('/workers');
    setWorkers(res.data?.data || []);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await load();
      } catch (err) {
        if (alive) setError(err.response?.data?.error || err.message || 'Failed to load workers.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [load]);

  const remove = async (worker) => {
    if (!window.confirm(`Remove ${worker.fullName} from the directory?`)) return;
    setBusyId(worker.workerId);
    setError(null);
    try {
      await apiClient.delete(`/workers/${worker.workerId}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to remove worker.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ padding: '8px', borderRadius: '10px', background: `${C.blue}22`, color: C.blue, display: 'flex' }}>
          <Users size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Municipal Worker Directory</h3>
          <div style={{ fontSize: '12px', color: C.textDim }}>{workers.length} worker{workers.length === 1 ? '' : 's'} on record</div>
        </div>
        <button type="button" onClick={() => setEditing({})} style={{ ...button(C.blue), background: C.blue, color: '#fff', border: 'none' }}>
          <Plus size={15} /> Add Worker
        </button>
      </div>

      {error && (
        <div style={{ background: `${C.red}18`, border: `1px solid ${C.red}55`, borderRadius: '12px', padding: '12px 16px', color: C.red, fontSize: '13px' }}>
          {error}
        </div>
      )}

      <div style={card}>
        {loading ? (
          <div style={{ color: C.textDim, fontSize: '14px' }}>Loading workers…</div>
        ) : workers.length === 0 ? (
          <div style={{ color: C.textFaint, fontSize: '13px', padding: '20px', textAlign: 'center' }}>No workers yet. Add one to start assigning repairs.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ color: C.textDim, textAlign: 'left' }}>
                  <th style={th}>Name</th>
                  <th style={th}>Specialty</th>
                  <th style={th}>Contact</th>
                  <th style={th}>Login</th>
                  <th style={th}>Status</th>
                  <th style={th}>Active Jobs</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr key={w.workerId} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ ...td, color: C.textStrong, fontWeight: 600 }}>{w.fullName}</td>
                    <td style={td}>{titleCase(w.specialty)}</td>
                    <td style={{ ...td, color: C.textDim }}>{w.phone || w.email || '—'}</td>
                    <td style={td}>
                      {w.hasLogin
                        ? <span style={{ color: C.purple, fontWeight: 600 }}>{w.username}</span>
                        : <span style={{ color: C.textFaint }}>No login</span>}
                    </td>
                    <td style={td}>
                      <span style={badge(STATUS_COLOR[w.status] || C.textDim)}>{titleCase(w.status)}</span>
                    </td>
                    <td style={td}>{w.activeJobs}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" onClick={() => setEditing(w)} title="Edit" style={iconBtn}>
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => remove(w)} disabled={busyId === w.workerId} title="Remove" style={{ ...iconBtn, color: C.red }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <WorkerForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
};

const th = { padding: '10px 12px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase' };
const td = { padding: '12px', verticalAlign: 'middle' };
const iconBtn = { background: 'transparent', border: 'none', color: C.textDim, cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'inline-flex' };

export default MunicipalWorkersView;
