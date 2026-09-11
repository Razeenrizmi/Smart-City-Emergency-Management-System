import React from 'react';
import {
  BarChart3,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Radio,
  Clock,
  Activity,
  Zap,
  CheckCircle,
  Users
} from 'lucide-react';

export default function AnalyticsDashboard({ stats, logs, hotlist, patrolUnits }) {
  const activeAlertsCount = logs.filter(l => l.isHotlistMatch && l.status === 'ALERT_TRIGGERED').length;
  const totalScanned = stats?.totalScannedToday || 18450;
  const hotlistHits = logs.filter(l => l.isHotlistMatch).length;

  return (
    <div className="analytics-dashboard-container">
      {/* Header */}
      <div className="section-header flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="text-cyan-400" size={24} />
            CRIME VEHICLE SURVEILLANCE & RESPONSE ANALYTICS
          </h2>
          <p className="text-xs text-slate-400">
            Real-time emergency operational metrics, system health, and threat resolution stats
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="badge badge-emerald flex items-center gap-1">
            <Activity size={12} className="animate-pulse" /> ANPR ENGINE ONLINE (99.8%)
          </span>
        </div>
      </div>

      {/* High-Level Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card bg-slate-900 border-slate-800 p-4 border-l-4 border-l-cyan-400">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-semibold text-slate-400">Total Vehicles Scanned Today</div>
              <div className="text-2xl font-extrabold text-white mt-1 font-mono">{totalScanned.toLocaleString()}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-cyan-950/60 text-cyan-400">
              <Zap size={22} />
            </div>
          </div>
          <div className="text-[11px] text-cyan-400 mt-3 flex items-center gap-1 font-medium">
            <TrendingUp size={14} /> +12.4% vs yesterday
          </div>
        </div>

        <div className="card bg-slate-900 border-slate-800 p-4 border-l-4 border-l-red-500">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-semibold text-slate-400">Hotlist Detections (Today)</div>
              <div className="text-2xl font-extrabold text-red-400 mt-1 font-mono">{hotlistHits}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-red-950/60 text-red-400">
              <AlertTriangle size={22} />
            </div>
          </div>
          <div className="text-[11px] text-red-400 mt-3 flex items-center gap-1 font-medium">
            <Radio size={14} className="animate-pulse" /> {activeAlertsCount} Unresolved High Alerts
          </div>
        </div>

        <div className="card bg-slate-900 border-slate-800 p-4 border-l-4 border-l-emerald-400">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-semibold text-slate-400">Active Patrol Units En-Route</div>
              <div className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono">
                {patrolUnits.filter(u => u.status === 'EN_ROUTE' || u.status === 'AVAILABLE').length} / {patrolUnits.length}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-950/60 text-emerald-400">
              <Users size={22} />
            </div>
          </div>
          <div className="text-[11px] text-emerald-400 mt-3 flex items-center gap-1 font-medium">
            <ShieldCheck size={14} /> 100% Intercept Readiness
          </div>
        </div>

        <div className="card bg-slate-900 border-slate-800 p-4 border-l-4 border-l-amber-400">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-semibold text-slate-400">Avg Interception Response Time</div>
              <div className="text-2xl font-extrabold text-amber-400 mt-1 font-mono">3.4 mins</div>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-950/60 text-amber-400">
              <Clock size={22} />
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-3">Target benchmark: &lt; 5 mins</div>
        </div>
      </div>

      {/* Visual Analytics Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Detection Alert Bar Chart Simulation */}
        <div className="card bg-slate-900 border-slate-800 p-5">
          <h3 className="font-bold text-white text-sm mb-4 flex items-center justify-between">
            <span>HOURLY CRIME VEHICLE DETECTION DISTRIBUTION</span>
            <span className="text-xs font-mono text-cyan-400">LAST 24 HOURS</span>
          </h3>

          <div className="h-48 flex items-end gap-3 pt-6 pb-2 border-b border-slate-800 px-2">
            {[
              { time: '02:00', value: 2, height: '20%' },
              { time: '05:00', value: 1, height: '10%' },
              { time: '08:00', value: 7, height: '65%' },
              { time: '11:00', value: 12, height: '90%' },
              { time: '14:00', value: 9, height: '75%' },
              { time: '17:00', value: 14, height: '100%' },
              { time: '20:00', value: 6, height: '50%' },
              { time: '23:00', value: 3, height: '30%' }
            ].map((bar, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="text-[10px] font-mono text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity">
                  {bar.value}
                </div>
                <div
                  className="w-full bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t group-hover:from-red-600 group-hover:to-red-400 transition-all cursor-pointer"
                  style={{ height: bar.height }}
                ></div>
                <span className="text-[10px] font-mono text-slate-400">{bar.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* High Risk Hotspots & Threat Breakdown */}
        <div className="card bg-slate-900 border-slate-800 p-5">
          <h3 className="font-bold text-white text-sm mb-4 flex items-center justify-between">
            <span>HIGH RISK INCIDENT SECTORS</span>
            <span className="text-xs font-mono text-amber-400">HOTSPOT ANALYSIS</span>
          </h3>

          <div className="space-y-4">
            {[
              { zone: 'Downtown Central (Main St Node)', risk: 'CRITICAL', percent: 85, color: 'bg-red-500' },
              { zone: 'Western Corridor Expressway', risk: 'HIGH', percent: 62, color: 'bg-amber-500' },
              { zone: 'Financial Quarter Plaza', risk: 'HIGH', percent: 54, color: 'bg-amber-500' },
              { zone: 'Metro City North Bridge', risk: 'MEDIUM', percent: 38, color: 'bg-cyan-500' }
            ].map((sector, idx) => (
              <div key={idx}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-200">{sector.zone}</span>
                  <span className="font-mono text-slate-400">{sector.risk} ({sector.percent}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full ${sector.color}`} style={{ width: `${sector.percent}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
