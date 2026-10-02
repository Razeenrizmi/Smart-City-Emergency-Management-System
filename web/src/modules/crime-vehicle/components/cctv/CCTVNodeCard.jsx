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
          ? 'bg-white border-cyan-200 shadow-lg shadow-cyan-500/10'
          : 'bg-white border-slate-200 hover:border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded-lg border ${active ? 'bg-cyan-50 border-cyan-200 text-cyan-600' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
            <Icon size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900 truncate">{node.cameraName}</div>
            <div className="text-[10px] text-slate-500 flex items-center gap-1 truncate">
              <MapPin size={10} className="shrink-0" /> {node.location}
            </div>
          </div>
        </div>
        <NodeStatus status={node.status} />
      </div>

      {cameraActive && (
        <div className="mt-2 grid grid-cols-4 gap-1 text-[9px] font-mono">
          <div className="bg-white/80 border border-slate-200 rounded px-1 py-0.5 text-center">
            <div className="text-slate-500">STREAM</div>
            <div className="text-cyan-600 font-bold">{fmt(s.streamFps)}</div>
          </div>
          <div className="bg-white/80 border border-slate-200 rounded px-1 py-0.5 text-center">
            <div className="text-slate-500">AI FPS</div>
            <div className="text-emerald-600 font-bold">{fmt(s.aiFps)}</div>
          </div>
          <div className="bg-white/80 border border-slate-200 rounded px-1 py-0.5 text-center">
            <div className="text-slate-500">VEHICLES</div>
            <div className="text-slate-900 font-bold">{fmt(s.vehicles)}</div>
          </div>
          <div className="bg-white/80 border border-slate-200 rounded px-1 py-0.5 text-center">
            <div className="text-slate-500">CRIME</div>
            <div className={`font-bold ${(s.crimeVehicles || 0) > 0 ? 'text-red-600' : 'text-slate-500'}`}>
              {fmt(s.crimeVehicles)}
            </div>
          </div>
        </div>
      )}

      <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between gap-2 text-[10px] font-mono">
        <span className="text-slate-500">NODE {String(node.nodeId).padStart(2, '0')} • {node.streamSource}</span>
        <div className="flex items-center gap-1.5">
          {monitoring && (
            <span className="px-1.5 py-0.5 rounded bg-cyan-50 border border-cyan-400 text-cyan-600 animate-pulse">
              {targetAiFps || 5} FPS
            </span>
          )}
          {cameraActive && onStop && (
            <button
              onClick={(e) => { e.stopPropagation(); onStop(node.nodeId); }}
              className="btn p-1 rounded bg-red-600/80 hover:bg-red-600 text-white border border-red-200"
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
