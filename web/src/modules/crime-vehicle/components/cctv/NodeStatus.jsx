import React from 'react';
import { Circle, Loader2, AlertTriangle, WifiOff, Radio } from 'lucide-react';

const STATUS_META = {
  ONLINE: { label: 'ONLINE', className: 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300', Icon: Circle, pulse: false },
  ANALYZING: { label: 'ANALYZING', className: 'bg-cyan-950/90 border-cyan-400 text-cyan-300', Icon: Radio, pulse: true },
  CONNECTING: { label: 'CONNECTING', className: 'bg-amber-950/80 border-amber-500/60 text-amber-300', Icon: Loader2, pulse: true },
  ERROR: { label: 'ERROR', className: 'bg-red-950/80 border-red-500/60 text-red-300', Icon: AlertTriangle, pulse: false },
  OFFLINE: { label: 'OFFLINE', className: 'bg-slate-800 border-slate-700 text-slate-400', Icon: WifiOff, pulse: false }
};

export default function NodeStatus({ status = 'OFFLINE', size = 'sm' }) {
  const meta = STATUS_META[status] || STATUS_META.OFFLINE;
  const { Icon } = meta;
  const iconSize = size === 'lg' ? 16 : 12;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border font-mono font-bold text-[10px] uppercase ${meta.className}`}
    >
      <Icon size={iconSize} className={meta.pulse ? 'animate-spin' : status === 'ONLINE' ? 'fill-emerald-400' : ''} />
      {meta.label}
    </span>
  );
}
