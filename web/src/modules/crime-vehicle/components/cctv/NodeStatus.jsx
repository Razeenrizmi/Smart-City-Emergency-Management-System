import { Circle, Loader2, AlertTriangle, WifiOff, Radio } from 'lucide-react';

const STATUS_META = {
  ONLINE: { label: 'ONLINE', className: 'bg-emerald-50 border-emerald-200 text-emerald-600', Icon: Circle, pulse: false },
  ANALYZING: { label: 'ANALYZING', className: 'bg-cyan-50 border-cyan-400 text-cyan-600', Icon: Radio, pulse: true },
  CONNECTING: { label: 'CONNECTING', className: 'bg-amber-50 border-amber-200 text-amber-600', Icon: Loader2, pulse: true },
  ERROR: { label: 'ERROR', className: 'bg-red-50 border-red-200 text-red-600', Icon: AlertTriangle, pulse: false },
  OFFLINE: { label: 'OFFLINE', className: 'bg-slate-100 border-slate-200 text-slate-500', Icon: WifiOff, pulse: false }
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
