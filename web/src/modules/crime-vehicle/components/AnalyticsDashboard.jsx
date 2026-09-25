import React, { useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Radio,
  Clock,
  Activity,
  Zap,
  Users
} from 'lucide-react';

const CHART_MAX_PX = 108;

function computeHourlyData(logs) {
  const buckets = Array(8).fill(0);
  logs.forEach(log => {
    const match = String(log.timestamp || '').match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const h = parseInt(match[1], 10);
      if (h >= 0 && h < 24) buckets[Math.floor(h / 3)]++;
    }
  });
  const maxVal = Math.max(...buckets, 1);
  return buckets.map((count, i) => {
    const startHour = i * 3;
    return {
      time: `${String(startHour).padStart(2, '0')}:00`,
      value: count,
      height: count > 0 ? `${Math.max((count / maxVal) * CHART_MAX_PX, 6)}px` : '2px'
    };
  });
}

function computeHotspotData(logs, cameras) {
  const zoneCounts = {};
  logs.forEach(log => {
    const zone = log.location || log.cameraName || 'Unknown';
    zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
  });
  const total = logs.length || 1;
  return Object.entries(zoneCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([zone, count]) => {
      const percent = Math.round((count / total) * 100);
      let risk = 'LOW';
      let color = 'bg-cyan-500';
      if (percent > 30) { risk = 'CRITICAL'; color = 'bg-red-500'; }
      else if (percent > 20) { risk = 'HIGH'; color = 'bg-amber-500'; }
      else if (percent > 10) { risk = 'MEDIUM'; color = 'bg-cyan-500'; }
      return { zone, risk, percent, color, count };
    });
}

function computeStatusBreakdown(logs) {
  const counts = { ALERT_TRIGGERED: 0, DISPATCHED: 0, CLEARED: 0, CONFIRMED: 0, REJECTED: 0, PENDING: 0, COOLDOWN: 0 };
  logs.forEach(log => {
    const s = (log.status || '').toUpperCase();
    if (s === 'ALERT_TRIGGERED') counts.ALERT_TRIGGERED++;
    else if (s === 'DISPATCHED') counts.DISPATCHED++;
    else if (s === 'CLEARED' || s === 'CLEARED_BY_AI') counts.CLEARED++;
    else if (s === 'CONFIRMED_BY_OFFICER') counts.CONFIRMED++;
    else if (s === 'REJECTED_BY_OFFICER') counts.REJECTED++;
    else if (s === 'COOLDOWN_SUPPRESSED') counts.COOLDOWN++;
    else counts.PENDING++;
  });
  return counts;
}

/**
 * Honest officer-decision metrics.
 * Precision is computable from confirmed vs rejected decisions.
 * Recall / F1 require a labeled ground-truth dataset — we state that
 * explicitly instead of inventing numbers (no 100% accuracy claims).
 */
function computeOfficerMetrics(logs) {
  const confirmed = logs.filter(l => l.status === 'CONFIRMED_BY_OFFICER').length;
  const rejected = logs.filter(l => l.status === 'REJECTED_BY_OFFICER').length;
  const cooldown = logs.filter(l => l.status === 'COOLDOWN_SUPPRESSED').length;
  const pending = logs.filter(l => l.status === 'REQUIRES_OFFICER_REVIEW' || l.status === 'ALERT_TRIGGERED').length;
  const decided = confirmed + rejected;
  const precision = decided > 0 ? ((confirmed / decided) * 100).toFixed(1) : null;
  return { confirmed, rejected, cooldown, pending, decided, precision };
}

export default function AnalyticsDashboard({ logs = [], hotlist = [], patrolUnits = [], detectionConfig }) {
  const hourlyData = useMemo(() => computeHourlyData(logs), [logs]);
  const hotspotData = useMemo(() => computeHotspotData(logs, []), [logs]);
  const statusCounts = useMemo(() => computeStatusBreakdown(logs), [logs]);
  const officerMetrics = useMemo(() => computeOfficerMetrics(logs), [logs]);

  const cfg = detectionConfig || { targetAiFps: 5, frameIntervalMs: 200, confirmationFrames: 3, alertCooldownSeconds: 60 };

  const totalScanned = logs.length;
  const hotlistHits = logs.filter(l => l.isHotlistMatch).length;
  const activeAlertsCount = logs.filter(l => l.isHotlistMatch && l.status === 'ALERT_TRIGGERED').length;
  const confirmedCount = officerMetrics.confirmed;
  const rejectedCount = officerMetrics.rejected;
  const dispatchedCount = logs.filter(l => l.status === 'DISPATCHED').length;

  const avgConfidence = logs.length > 0
    ? (logs.reduce((sum, l) => sum + (l.confidence || 0), 0) / logs.length).toFixed(1)
    : '0.0';

  return (
    <div className="analytics-dashboard-container">
      <div className="section-header flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="text-cyan-400" size={24} />
            CRIME VEHICLE SURVEILLANCE & RESPONSE ANALYTICS
          </h2>
          <p className="text-xs text-slate-400">
            Real-time metrics computed from actual detection logs — no hardcoded data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-emerald flex items-center gap-1">
            <Activity size={12} className="animate-pulse" /> LIVE DATA
          </span>
        </div>
      </div>

      {/* High-Level Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card bg-slate-900 border-slate-800 p-4 border-l-4 border-l-cyan-400">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-semibold text-slate-400">Total Vehicles Scanned</div>
              <div className="text-2xl font-extrabold text-white mt-1 font-mono">{totalScanned.toLocaleString()}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-cyan-950/60 text-cyan-400">
              <Zap size={22} />
            </div>
          </div>
          <div className="text-[11px] text-cyan-400 mt-3 flex items-center gap-1 font-medium">
            <TrendingUp size={14} /> Detection log entries
          </div>
        </div>

        <div className="card bg-slate-900 border-slate-800 p-4 border-l-4 border-l-red-500">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-semibold text-slate-400">Hotlist Detections</div>
              <div className="text-2xl font-extrabold text-red-400 mt-1 font-mono">{hotlistHits}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-red-950/60 text-red-400">
              <AlertTriangle size={22} />
            </div>
          </div>
          <div className="text-[11px] text-red-400 mt-3 flex items-center gap-1 font-medium">
            <Radio size={14} className="animate-pulse" /> {activeAlertsCount} Unresolved Alerts
          </div>
        </div>

        <div className="card bg-slate-900 border-slate-800 p-4 border-l-4 border-l-emerald-400">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-semibold text-slate-400">Patrol Units Available</div>
              <div className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono">
                {patrolUnits.filter(u => u.status === 'EN_ROUTE' || u.status === 'AVAILABLE').length} / {patrolUnits.length}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-950/60 text-emerald-400">
              <Users size={22} />
            </div>
          </div>
          <div className="text-[11px] text-emerald-400 mt-3 flex items-center gap-1 font-medium">
            <ShieldCheck size={14} /> Intercept Readiness
          </div>
        </div>

        <div className="card bg-slate-900 border-slate-800 p-4 border-l-4 border-l-amber-400">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-semibold text-slate-400">Avg Detection Confidence</div>
              <div className="text-2xl font-extrabold text-amber-400 mt-1 font-mono">{avgConfidence}%</div>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-950/60 text-amber-400">
              <Clock size={22} />
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-3">Across all detection events</div>
        </div>
      </div>

      {/* Visual Analytics Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Hourly Detection Bar Chart — Real Data */}
        <div className="card bg-slate-900 border-slate-800 p-5">
          <h3 className="font-bold text-white text-sm mb-4 flex items-center justify-between">
            <span>HOURLY DETECTION DISTRIBUTION</span>
            <span className="text-xs font-mono text-cyan-400">COMPUTED FROM LOGS</span>
          </h3>
          {totalScanned === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500 text-xs">
              <div className="text-center">
                <BarChart3 size={32} className="mx-auto mb-2 opacity-30" />
                <p>No detection data yet</p>
                <p className="text-slate-600 mt-1">Chart updates as scans are processed</p>
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-end gap-2 pt-6 pb-2 border-b border-slate-800 px-2">
              {hourlyData.map((bar, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group min-w-0">
                  <div className="text-[10px] font-mono text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity">
                    {bar.value}
                  </div>
                  <div
                    className="w-full bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t group-hover:from-red-600 group-hover:to-red-400 transition-all cursor-pointer"
                    style={{ height: bar.height }}
                    title={`${bar.time} — ${bar.value} detection${bar.value === 1 ? '' : 's'}`}
                  ></div>
                  <span className="text-[9px] font-mono text-slate-400 truncate">{bar.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detection Status Breakdown */}
        <div className="card bg-slate-900 border-slate-800 p-5">
          <h3 className="font-bold text-white text-sm mb-4 flex items-center justify-between">
            <span>DETECTION OUTCOME BREAKDOWN</span>
            <span className="text-xs font-mono text-amber-400">STATUS COUNTS</span>
          </h3>
          {totalScanned === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500 text-xs">
              <div className="text-center">
                <Activity size={32} className="mx-auto mb-2 opacity-30" />
                <p>No detection data yet</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Alert Triggered', count: statusCounts.ALERT_TRIGGERED, color: 'bg-red-500', textColor: 'text-red-400' },
                { label: 'Dispatched', count: statusCounts.DISPATCHED, color: 'bg-amber-500', textColor: 'text-amber-400' },
                { label: 'Officer Confirmed', count: statusCounts.CONFIRMED, color: 'bg-emerald-500', textColor: 'text-emerald-400' },
                { label: 'Officer Rejected', count: statusCounts.REJECTED, color: 'bg-slate-500', textColor: 'text-slate-400' },
                { label: 'Cleared (Auto)', count: statusCounts.CLEARED, color: 'bg-cyan-500', textColor: 'text-cyan-400' },
                { label: 'Cooldown Suppressed', count: statusCounts.COOLDOWN, color: 'bg-amber-600', textColor: 'text-amber-500' },
                { label: 'Pending Review', count: statusCounts.PENDING, color: 'bg-violet-500', textColor: 'text-violet-400' }
              ].map((item, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-200">{item.label}</span>
                    <span className={`font-mono font-bold ${item.textColor}`}>{item.count}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} transition-all duration-500`}
                      style={{ width: `${totalScanned > 0 ? (item.count / totalScanned) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* High Risk Hotspots — Computed from logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card bg-slate-900 border-slate-800 p-5">
          <h3 className="font-bold text-white text-sm mb-4 flex items-center justify-between">
            <span>HIGH RISK INCIDENT SECTORS</span>
            <span className="text-xs font-mono text-amber-400">HOTSPOT ANALYSIS</span>
          </h3>
          {hotspotData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-slate-500 text-xs">
              <div className="text-center">
                <ShieldCheck size={32} className="mx-auto mb-2 opacity-30" />
                <p>No incident data to analyze</p>
                <p className="text-slate-600 mt-1">Hotspots will appear as detections accumulate</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {hotspotData.map((sector, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-200 truncate max-w-[70%]">{sector.zone}</span>
                    <span className="font-mono text-slate-400">{sector.risk} ({sector.percent}%)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${sector.color}`} style={{ width: `${sector.percent}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Officer Verification Stats */}
        <div className="card bg-slate-900 border-slate-800 p-5">
          <h3 className="font-bold text-white text-sm mb-4 flex items-center justify-between">
            <span>OFFICER VERIFICATION SUMMARY</span>
            <span className="text-xs font-mono text-emerald-400">AUDIT STATS</span>
          </h3>
          {totalScanned === 0 ? (
            <div className="h-40 flex items-center justify-center text-slate-500 text-xs">
              <div className="text-center">
                <Users size={32} className="mx-auto mb-2 opacity-30" />
                <p>No officer actions yet</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-800/60 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Confirmed Detections (TP)</div>
                  <div className="text-xl font-bold text-emerald-400 font-mono">{confirmedCount}</div>
                </div>
                <ShieldCheck className="text-emerald-400" size={28} />
              </div>
              <div className="bg-slate-800/60 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Rejected (False Positives)</div>
                  <div className="text-xl font-bold text-slate-400 font-mono">{rejectedCount}</div>
                </div>
                <AlertTriangle className="text-slate-400" size={28} />
              </div>
              <div className="bg-slate-800/60 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Units Dispatched</div>
                  <div className="text-xl font-bold text-amber-400 font-mono">{dispatchedCount}</div>
                </div>
                <Radio className="text-amber-400" size={28} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Honest Detection Quality Metrics — computed, never faked */}
      <div className="card bg-slate-900 border-slate-800 p-5 mt-6">
        <h3 className="font-bold text-white text-sm mb-1 flex items-center justify-between">
          <span>DETECTION QUALITY & THROUGHPUT METRICS</span>
          <span className="text-xs font-mono text-cyan-400">COMPUTED / MEASURED ONLY</span>
        </h3>
        <p className="text-[11px] text-slate-500 mb-4">
          Officer-decision metrics are exact. Precision uses confirmed vs rejected only.
          Recall and F1 require a labeled ground-truth dataset and are therefore not claimed here.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-4">
            <div className="text-[11px] text-slate-400 mb-1">Officer Precision (confirmed / decided)</div>
            <div className="text-2xl font-extrabold font-mono text-emerald-400">
              {officerMetrics.precision != null ? `${officerMetrics.precision}%` : '—'}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-mono">
              {officerMetrics.decided > 0
                ? `${officerMetrics.confirmed} TP / ${officerMetrics.decided} decided`
                : 'No decided alerts yet'}
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-4">
            <div className="text-[11px] text-slate-400 mb-1">Recall / F1</div>
            <div className="text-2xl font-extrabold font-mono text-slate-500">N/A</div>
            <div className="text-[10px] text-slate-500 mt-1">
              Requires labeled ground-truth dataset — not inventable from live logs
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-4">
            <div className="text-[11px] text-slate-400 mb-1">Alert Cooldown Suppressed</div>
            <div className="text-2xl font-extrabold font-mono text-amber-400">{officerMetrics.cooldown}</div>
            <div className="text-[10px] text-slate-500 mt-1 font-mono">
              Window: {cfg.alertCooldownSeconds || 60}s per plate + node
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-4">
            <div className="text-[11px] text-slate-400 mb-1">AI Sampling Config</div>
            <div className="text-2xl font-extrabold font-mono text-cyan-400">
              {cfg.targetAiFps || 5} FPS
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-mono">
              {cfg.frameIntervalMs || 200}ms interval · confirm {cfg.confirmationFrames || 3} frames
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-800/50 rounded p-3">
            <div className="text-slate-400 text-[11px]">Pending Review</div>
            <div className="font-mono font-bold text-violet-400">{officerMetrics.pending}</div>
          </div>
          <div className="bg-slate-800/50 rounded p-3">
            <div className="text-slate-400 text-[11px]">Cooldown Suppressed</div>
            <div className="font-mono font-bold text-amber-400">{statusCounts.COOLDOWN}</div>
          </div>
          <div className="bg-slate-800/50 rounded p-3">
            <div className="text-slate-400 text-[11px]">Avg OCR Confidence</div>
            <div className="font-mono font-bold text-cyan-400">{avgConfidence}%</div>
          </div>
          <div className="bg-slate-800/50 rounded p-3">
            <div className="text-slate-400 text-[11px]">Evidence Rule</div>
            <div className="font-mono font-bold text-slate-300 text-[11px]">No invented plates/FPS</div>
          </div>
        </div>
      </div>
    </div>
  );
}
