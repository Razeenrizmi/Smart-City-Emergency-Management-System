import { useMemo, useState } from 'react';
import { Search, RefreshCw, CheckCircle, Activity, Layers, AlertTriangle, MapPin, ExternalLink, Inbox } from 'lucide-react';
import { C, card, button, badge, input } from '../theme';
import { statusMeta, fmtDate } from '../workflow';

const HAZARD_TYPES = ['POTHOLE', 'ROAD_CRACK', 'DEBRIS', 'FLOODING', 'SURFACE_DAMAGE'];
const SEVERITIES = [5, 4, 3, 2, 1];

const typeOf = (h) => (h.aiDetectedCategory || h.hazardType || 'HAZARD').toUpperCase();
const timeOf = (h) => new Date(h.resolvedAt || h.createdAt || 0).getTime();

const CountCard = ({ label, value, color, icon: Icon }) => (
  <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '14px', padding: '18px' }}>
    <div style={{ padding: '10px', borderRadius: '12px', background: `${color}1a`, color, display: 'flex' }}>
      <Icon size={20} />
    </div>
    <div>
      <div style={{ color: C.textDim, fontSize: '12px', fontWeight: 600 }}>{label}</div>
      <div style={{ color: C.textStrong, fontSize: '26px', fontWeight: 700 }}>{value}</div>
    </div>
  </div>
);

const th = { padding: '12px 16px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' };
const td = { padding: '12px 16px', verticalAlign: 'middle' };

const selectStyle = { ...input, width: 'auto', minWidth: '160px', cursor: 'pointer' };

const ResolvedHazardsView = ({ hazards = [], onRefresh }) => {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('ALL');
  const [severity, setSeverity] = useState('ALL');
  const [sort, setSort] = useState('resolved_desc');

  const active = useMemo(() => hazards.filter((h) => h.approvalStatus !== 'RESOLVED'), [hazards]);
  const resolved = useMemo(() => hazards.filter((h) => h.approvalStatus === 'RESOLVED'), [hazards]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = resolved.filter((h) => {
      if (type !== 'ALL' && typeOf(h) !== type) return false;
      if (severity !== 'ALL' && Number(h.severityScore) !== Number(severity)) return false;
      if (!q) return true;
      const haystack = [
        h.hazardId,
        h.hazardType,
        h.aiDetectedCategory,
        `${Number(h.latitude || 0).toFixed(4)}, ${Number(h.longitude || 0).toFixed(4)}`,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    return rows.sort((a, b) => {
      if (sort === 'severity_desc') return (b.severityScore || 0) - (a.severityScore || 0);
      const ta = timeOf(a);
      const tb = timeOf(b);
      return sort === 'resolved_asc' ? ta - tb : tb - ta;
    });
  }, [resolved, query, type, severity, sort]);

  const hasFilters = query !== '' || type !== 'ALL' || severity !== 'ALL';
  const clearFilters = () => {
    setQuery('');
    setType('ALL');
    setSeverity('ALL');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ padding: '8px', borderRadius: '10px', background: `${C.green}22`, color: C.green, display: 'flex' }}>
          <CheckCircle size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Resolved Hazard History</h3>
          <div style={{ fontSize: '12px', color: C.textDim }}>
            Past hazard reports that have been repaired and retired. Search or filter to find a specific record.
          </div>
        </div>
        {onRefresh && (
          <button type="button" onClick={onRefresh} style={button(C.blue)}>
            <RefreshCw size={14} /> Refresh
          </button>
        )}
      </div>

      {/* Counts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <CountCard label="Active Hazards" value={active.length} color={C.blue} icon={Activity} />
        <CountCard label="Resolved Hazards" value={resolved.length} color={C.green} icon={CheckCircle} />
        <CountCard label="Total Reports" value={hazards.length} color={C.purple} icon={Layers} />
      </div>

      {/* Search + filters */}
      <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', padding: '16px' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '220px' }}>
          <Search size={15} color={C.textFaint} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by type, ID or coordinates…"
            style={{ ...input, paddingLeft: '34px' }}
          />
        </div>

        <select value={type} onChange={(e) => setType(e.target.value)} style={selectStyle} aria-label="Filter by hazard type">
          <option value="ALL">All types</option>
          {HAZARD_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={selectStyle} aria-label="Filter by severity">
          <option value="ALL">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>Severity {s}/5</option>
          ))}
        </select>

        <select value={sort} onChange={(e) => setSort(e.target.value)} style={selectStyle} aria-label="Sort results">
          <option value="resolved_desc">Newest resolved</option>
          <option value="resolved_asc">Oldest resolved</option>
          <option value="severity_desc">Severity (high → low)</option>
        </select>

        {hasFilters && (
          <button type="button" onClick={clearFilters} style={button(C.textDim)}>
            Clear filters
          </button>
        )}
      </div>

      {/* Results */}
      {resolved.length === 0 ? (
        <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '44px', color: C.textFaint }}>
          <Inbox size={26} />
          <span style={{ fontSize: '14px' }}>No resolved hazards yet.</span>
        </div>
      ) : (
        <>
          <div style={{ fontSize: '12px', color: C.textDim }}>
            Showing <strong style={{ color: C.text }}>{filtered.length}</strong> of {resolved.length} resolved reports
          </div>

          {filtered.length === 0 ? (
            <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '44px', color: C.textFaint }}>
              <AlertTriangle size={24} />
              <span style={{ fontSize: '14px' }}>No resolved reports match your filters.</span>
              <button type="button" onClick={clearFilters} style={button(C.blue)}>Clear filters</button>
            </div>
          ) : (
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: C.surfaceAlt, color: C.textDim, textAlign: 'left' }}>
                      <th style={th}>Type</th>
                      <th style={th}>Severity</th>
                      <th style={th}>Location</th>
                      <th style={th}>AI Confidence</th>
                      <th style={th}>Reported</th>
                      <th style={th}>Resolved</th>
                      <th style={th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((h) => {
                      const meta = statusMeta(h.approvalStatus);
                      return (
                        <tr key={h.hazardId} style={{ borderTop: `1px solid ${C.border}` }}>
                          <td style={td}><strong>{typeOf(h)}</strong></td>
                          <td style={td}>
                            <span style={badge(h.severityScore >= 4 ? C.red : h.severityScore >= 3 ? C.orange : C.blue)}>
                              {h.severityScore}/5
                            </span>
                          </td>
                          <td style={td}>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${h.latitude},${h.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: C.blue, textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}
                            >
                              <MapPin size={12} />
                              {Number(h.latitude || 0).toFixed(4)}, {Number(h.longitude || 0).toFixed(4)}
                              <ExternalLink size={10} />
                            </a>
                          </td>
                          <td style={td}>{h.aiConfidenceScore > 0 ? `${(h.aiConfidenceScore * 100).toFixed(0)}%` : '—'}</td>
                          <td style={{ ...td, color: C.textDim }}>{fmtDate(h.createdAt)}</td>
                          <td style={{ ...td, color: C.textDim }}>{h.resolvedAt ? fmtDate(h.resolvedAt) : '—'}</td>
                          <td style={td}><span style={badge(meta.color)}>{meta.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ResolvedHazardsView;
