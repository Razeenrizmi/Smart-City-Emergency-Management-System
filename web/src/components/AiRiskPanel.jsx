import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, TrendingUp, Shield, Zap, RefreshCw } from 'lucide-react';
import apiClient from '../services/appClient';

const RdiGauge = ({ value }) => {
  const clamped = Math.min(100, Math.max(0, value));
  const color =
    clamped >= 70 ? '#E53E3E' :
    clamped >= 50 ? '#ED8936' :
    clamped >= 30 ? '#ECC94B' :
    '#48BB78';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ flex: 1, height: '8px', background: '#21262D', borderRadius: '4px', overflow: 'hidden' }}>
        <div
          style={{
            width: `${clamped}%`,
            height: '100%',
            background: `linear-gradient(90deg, #48BB78, ${color})`,
            borderRadius: '4px',
            transition: 'width 1s ease',
          }}
        />
      </div>
      <span style={{ color, fontWeight: 700, fontSize: '14px', minWidth: '36px' }}>
        {clamped.toFixed(0)}
      </span>
    </div>
  );
};

const AiRiskPanel = () => {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchInsights = useCallback(async () => {
    try {
      const res = await apiClient.get('/ai/insights');
      if (res.data?.success) {
        setInsights(res.data.data);
        setLastUpdated(new Date());
      }
    } catch {
      // Silently fail — panel just shows empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => { await fetchInsights(); })();
    const interval = setInterval(fetchInsights, 60_000); // refresh every minute
    return () => clearInterval(interval);
  }, [fetchInsights]);

  const rdi = insights?.cityRoadDangerIndex ?? 0;
  const rdiColor =
    rdi >= 70 ? '#E53E3E' :
    rdi >= 50 ? '#ED8936' :
    rdi >= 30 ? '#ECC94B' :
    '#48BB78';

  const rdiLabel =
    rdi >= 70 ? 'CRITICAL' :
    rdi >= 50 ? 'HIGH RISK' :
    rdi >= 30 ? 'MODERATE' :
    'LOW RISK';

  return (
    <div
      id="ai-risk-panel"
      style={{
        background: 'linear-gradient(135deg, rgba(22,27,34,0.98) 0%, rgba(13,17,23,0.98) 100%)',
        borderBottom: `2px solid ${rdiColor}40`,
        padding: '14px 32px',
        display: 'flex',
        alignItems: 'center',
        gap: '32px',
        flexWrap: 'wrap',
        position: 'relative',
      }}
    >
      {/* Animated accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: `linear-gradient(90deg, #667EEA, ${rdiColor}, #764BA2)`,
        backgroundSize: '200% 100%',
        animation: 'gradientShift 3s ease infinite',
      }} />

      {/* RDI Score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '260px', flex: 1 }}>
        <div style={{
          padding: '8px',
          background: `${rdiColor}20`,
          borderRadius: '10px',
          border: `1px solid ${rdiColor}40`,
        }}>
          <TrendingUp size={20} color={rdiColor} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: '#8B949E', fontWeight: 600, letterSpacing: '0.8px' }}>
              CITY ROAD DANGER INDEX
            </span>
            <span style={{
              fontSize: '10px', fontWeight: 700, padding: '2px 6px',
              borderRadius: '4px', background: `${rdiColor}25`, color: rdiColor,
              letterSpacing: '0.5px',
            }}>
              {rdiLabel}
            </span>
          </div>
          {loading ? (
            <div style={{ color: '#4A5568', fontSize: '13px' }}>Calculating…</div>
          ) : (
            <RdiGauge value={rdi} />
          )}
        </div>
      </div>

      {/* Stats pills */}
      {insights && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <StatPill
            icon={<Shield size={14} />}
            label="AI Verified"
            value={`${insights.verifiedHazardsPercent?.toFixed(1) ?? 0}%`}
            color="#48BB78"
          />
          <StatPill
            icon={<Zap size={14} />}
            label="Clusters"
            value={insights.totalClusters ?? 0}
            color="#667EEA"
          />
          <StatPill
            icon={<AlertTriangle size={14} />}
            label="Total Reports"
            value={insights.totalHazards ?? 0}
            color="#ED8936"
          />
        </div>
      )}

      {/* Dispatch advisory */}
      {insights?.dispatchAdvisories?.[0] && (
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid #30363D',
          borderRadius: '8px',
          padding: '6px 12px',
          fontSize: '12px',
          color: '#CBD5E0',
          maxWidth: '320px',
          flex: 1,
        }}>
          {insights.dispatchAdvisories[0]}
        </div>
      )}

      {/* Right: refresh + last updated */}
      <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
        <button
          id="ai-refresh-insights-btn"
          onClick={fetchInsights}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#4A5568', display: 'flex', alignItems: 'center', gap: '4px',
            fontSize: '11px', padding: '4px 8px', borderRadius: '6px',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#A0AEC0'}
          onMouseLeave={e => e.currentTarget.style.color = '#4A5568'}
        >
          <RefreshCw size={12} />
          Refresh
        </button>
        {lastUpdated && (
          <span style={{ fontSize: '10px', color: '#4A5568' }}>
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
};

const StatPill = ({ icon, label, value, color }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '6px',
    background: `${color}12`,
    border: `1px solid ${color}30`,
    borderRadius: '20px',
    padding: '4px 10px',
    color,
    fontSize: '12px',
    fontWeight: 600,
  }}>
    {icon}
    <span style={{ color: '#8B949E', fontWeight: 400 }}>{label}:</span>
    <span>{value}</span>
  </div>
);

export default AiRiskPanel;
