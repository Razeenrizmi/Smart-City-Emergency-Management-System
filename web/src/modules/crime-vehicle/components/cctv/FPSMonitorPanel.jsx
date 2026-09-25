import React from 'react';
import { Activity, Gauge } from 'lucide-react';

const MAX_ROWS = 40;

/**
 * Honest FPS monitor — every number comes from a real completed frame
 * (backend frameStats or client-measured round trip). Never estimated.
 */
export default function FPSMonitorPanel({ frameLog = [], targetAiFps, frameIntervalMs }) {
  const rows = frameLog.slice(0, MAX_ROWS);

  const recent = frameLog.slice(0, Math.min(frameLog.length, 30));
  const avgProc = recent.length > 0
    ? (recent.reduce((sum, r) => sum + (r.processingMs || 0), 0) / recent.length).toFixed(1)
    : null;
  const measuredAiFps = recent.length >= 2
    ? (() => {
        const times = recent.map(r => new Date(r.clientAt || r.timestamp).getTime()).filter(t => !Number.isNaN(t));
        if (times.length < 2) return null;
        const span = (times[0] - times[times.length - 1]) / 1000;
        if (span <= 0) return null;
        return ((recent.length - 1) / span).toFixed(2);
      })()
    : null;
  const last = frameLog[0] || null;

  return (
    <div className="card bg-slate-900 border-slate-800 p-4 rounded-xl mb-4">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <Gauge size={16} className="text-cyan-400" />
          AI FRAME RATE MONITOR
        </h3>
        <span className="text-[10px] font-mono text-slate-400">
          TARGET {targetAiFps || 5} FPS / {frameIntervalMs || 200}ms — MEASURED VALUES ONLY
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-[10px] font-mono">
        <div className="bg-slate-950/70 border border-slate-800 rounded p-2 text-center">
          <div className="text-slate-500">MEASURED AI FPS (last 30)</div>
          <div className="text-emerald-300 font-bold text-sm">{measuredAiFps ?? '—'}</div>
        </div>
        <div className="bg-slate-950/70 border border-slate-800 rounded p-2 text-center">
          <div className="text-slate-500">AVG PROCESSING</div>
          <div className="text-cyan-300 font-bold text-sm">{avgProc != null ? `${avgProc}ms` : '—'}</div>
        </div>
        <div className="bg-slate-950/70 border border-slate-800 rounded p-2 text-center">
          <div className="text-slate-500">LAST AI FPS (server)</div>
          <div className="text-amber-300 font-bold text-sm">{last?.aiFps != null ? last.aiFps : '—'}</div>
        </div>
        <div className="bg-slate-950/70 border border-slate-800 rounded p-2 text-center">
          <div className="text-slate-500">FRAMES LOGGED</div>
          <div className="text-slate-200 font-bold text-sm">{frameLog.length}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="h-24 flex items-center justify-center text-slate-500 text-xs">
          <Activity size={16} className="mr-2 opacity-40" />
          No frames processed yet — start CCTV monitoring to populate the frame log
        </div>
      ) : (
        <div className="overflow-x-auto max-h-48 overflow-y-auto border border-slate-800 rounded">
          <table className="w-full text-[10px] font-mono">
            <thead className="bg-slate-950 text-slate-400 sticky top-0">
              <tr>
                <th className="px-2 py-1.5 text-left">Node</th>
                <th className="px-2 py-1.5 text-left">Timestamp</th>
                <th className="px-2 py-1.5 text-right">Frame#</th>
                <th className="px-2 py-1.5 text-right">Proc ms</th>
                <th className="px-2 py-1.5 text-right">Dets</th>
                <th className="px-2 py-1.5 text-right">Tracks</th>
                <th className="px-2 py-1.5 text-right">AI FPS</th>
                <th className="px-2 py-1.5 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.nodeId}-${r.frameNumber}-${r.clientAt || i}`} className={`border-t border-slate-800/60 ${i === 0 ? 'bg-cyan-950/20' : ''}`}>
                  <td className="px-2 py-1 text-cyan-300">N{String(r.nodeId ?? '--').padStart(2, '0')}</td>
                  <td className="px-2 py-1 text-slate-400">{r.timestamp || '—'}</td>
                  <td className="px-2 py-1 text-right text-slate-300">{r.frameNumber ?? '—'}</td>
                  <td className="px-2 py-1 text-right text-slate-300">{r.processingMs != null ? r.processingMs : '—'}</td>
                  <td className="px-2 py-1 text-right text-slate-300">{r.detectionCount ?? '—'}</td>
                  <td className="px-2 py-1 text-right text-slate-300">{r.trackCount ?? '—'}</td>
                  <td className="px-2 py-1 text-right text-emerald-300">{r.aiFps ?? '—'}</td>
                  <td className="px-2 py-1 text-slate-400 truncate max-w-[120px]">{r.status || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
