import React from 'react';
import { Camera, MapPin, Laptop, Smartphone, Radio, Square } from 'lucide-react';
import NodeStatus from './NodeStatus';

const TYPE_ICON = {
  LAPTOP_WEBCAM: Laptop,
  MOBILE_CAMERA: Smartphone,
  NETWORK_STREAM: Radio
};

const fmt = (v, suffix = '') => (v === null || v === undefined ? '—' : `${v}${suffix}`);

export default function CCTVNodeCard({ node, active, monitoring, cameraActive, stats, targetAiFps, onSelect, onStop }) {
  const Icon = TYPE_ICON[node.cameraType] || Radio;
  const s = stats || {};

  return (
    <div
      onClick={() => onSelect?.(node.nodeId)}
      className={`card p-3 rounded-xl border cursor-pointer transition-all ${
        active
          ? 'bg-slate-900 border-cyan-500/60 shadow-lg shadow-cyan-500/10'
          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded-lg border ${active ? 'bg-cyan-950 border-cyan-500/50 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
            <Icon size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">{node.cameraName}</div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
              <MapPin size={10} className="shrink-0" /> {node.location}
            </div>
          </div>
        </div>
        <NodeStatus status={node.status} />
      </div>

      {cameraActive && (
        <div className="mt-2 grid grid-cols-4 gap-1 text-[9px] font-mono">
          <div className="bg-slate-950/70 border border-slate-800 rounded px-1 py-0.5 text-center">
            <div className="text-slate-500">STREAM</div>
            <div className="text-cyan-300 font-bold">{fmt(s.streamFps)}</div>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 rounded px-1 py-0.5 text-center">
            <div className="text-slate-500">AI FPS</div>
            <div className="text-emerald-300 font-bold">{fmt(s.aiFps)}</div>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 rounded px-1 py-0.5 text-center">
            <div className="text-slate-500">VEHICLES</div>
            <div className="text-slate-200 font-bold">{fmt(s.vehicles)}</div>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 rounded px-1 py-0.5 text-center">
            <div className="text-slate-500">CRIME</div>
            <div className={`font-bold ${(s.crimeVehicles || 0) > 0 ? 'text-red-400' : 'text-slate-400'}`}>
              {fmt(s.crimeVehicles)}
            </div>
          </div>
        </div>
      )}

      <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between gap-2 text-[10px] font-mono">
        <span className="text-slate-500">NODE {String(node.nodeId).padStart(2, '0')} • {node.streamSource}</span>
        <div className="flex items-center gap-1.5">
          {monitoring && (
            <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-400 text-cyan-300 animate-pulse">
              {targetAiFps || 5} FPS
            </span>
          )}
          {cameraActive && onStop && (
            <button
              onClick={(e) => { e.stopPropagation(); onStop(node.nodeId); }}
              className="btn p-1 rounded bg-red-600/80 hover:bg-red-600 text-white border border-red-500/50"
              title="Stop camera node"
            >
              <Square size={11} />
            </button>
          )}
          {!cameraActive && (
            <span className="text-slate-500 flex items-center gap-1">
              <Camera size={11} /> {node.cameraType === 'MOBILE_CAMERA' ? 'PHONE' : 'WEBCAM'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
