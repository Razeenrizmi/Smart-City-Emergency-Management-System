import React from 'react';
import { LayoutGrid } from 'lucide-react';
import CCTVNodeCard from './CCTVNodeCard';

export default function CCTVNodeGrid({ nodes = [], activeNodeId, nodeRuntime = {}, targetAiFps, onSelect, onStop }) {
  return (
    <div className="card bg-slate-900 border-slate-800 p-4 rounded-xl mb-4">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <LayoutGrid size={16} className="text-cyan-400" />
          CCTV SURVEILLANCE NODES ({nodes.length})
        </h3>
        <span className="text-[10px] font-mono text-slate-400">
          SELECT A NODE TO VIEW ITS LIVE FEED
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {nodes.map((node) => {
          const rt = nodeRuntime[node.nodeId] || {};
          return (
            <CCTVNodeCard
              key={node.nodeId}
              node={node}
              active={node.nodeId === activeNodeId}
              monitoring={!!rt.isMonitoring}
              cameraActive={!!rt.isCameraActive}
              stats={rt.stats}
              targetAiFps={targetAiFps}
              onSelect={onSelect}
              onStop={onStop}
            />
          );
        })}
      </div>
    </div>
  );
}
