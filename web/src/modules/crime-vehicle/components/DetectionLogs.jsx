import React, { useState } from 'react';
import {
  FileText, Search, Eye, AlertTriangle, CheckCircle, Shield, X,
  UserCheck, UserX, Clock, Camera, ImageOff, History, Radar
} from 'lucide-react';
import { crimeVehicleService } from '../services/crimeVehicleService';
import { cctvService } from '../services/cctvService';

const VEHICLE_TYPES = ['Car', 'Motorcycle', 'Bus', 'Truck'];
const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'REQUIRES_OFFICER_REVIEW', label: 'Requires Officer Review' },
  { value: 'CLEARED', label: 'Cleared' },
  { value: 'CONFIRMED_BY_OFFICER', label: 'Confirmed by Officer' },
  { value: 'REJECTED_BY_OFFICER', label: 'Rejected by Officer' },
  { value: 'DISPATCHED', label: 'Dispatched' }
];

export default function DetectionLogs({ logs, snapshots = {}, nodes = [], onOpenDispatch }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [matchOnly, setMatchOnly] = useState(false);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [localLogs, setLocalLogs] = useState(logs || []);

  // History filters
  const [nodeFilter, setNodeFilter] = useState('');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Observation history modal
  const [obsPlate, setObsPlate] = useState(null);
  const [observations, setObservations] = useState([]);
  const [obsLoading, setObsLoading] = useState(false);

  React.useEffect(() => {
    setLocalLogs(logs);
  }, [logs]);

  const isReviewable = (status) => status === 'REQUIRES_OFFICER_REVIEW';

  const handleApprove = async (logId, e) => {
    if (e) e.stopPropagation();
    await crimeVehicleService.approveDetection(logId);
    setLocalLogs(prev => prev.map(l => l.logId === logId || l.id === logId ? { ...l, status: 'CONFIRMED_BY_OFFICER' } : l));
    if (selectedLog && (selectedLog.logId === logId || selectedLog.id === logId)) {
      setSelectedLog(prev => ({ ...prev, status: 'CONFIRMED_BY_OFFICER' }));
    }
  };

  const handleReject = async (logId, e) => {
    if (e) e.stopPropagation();
    await crimeVehicleService.rejectDetection(logId);
    setLocalLogs(prev => prev.map(l => l.logId === logId || l.id === logId ? { ...l, status: 'REJECTED_BY_OFFICER' } : l));
    if (selectedLog && (selectedLog.logId === logId || selectedLog.id === logId)) {
      setSelectedLog(prev => ({ ...prev, status: 'REJECTED_BY_OFFICER' }));
    }
  };

  const openObservations = async (plate, e) => {
    if (e) e.stopPropagation();
    if (!plate || plate === 'NO_PLATE_DETECTED') return;
    setObsPlate(plate);
    setObsLoading(true);
    setObservations([]);
    const rows = await cctvService.getPlateObservations(plate);
    setObservations(rows);
    setObsLoading(false);
  };

  const logDate = (log) => String(log.timestamp || '').slice(0, 10);

  const filteredLogs = localLogs
    .map(log => {
      const logId = log.logId || log.id;
      const snapshotFromMap = snapshots[logId];
      if (snapshotFromMap && (!log.snapshot || log.snapshot.trim() === '')) {
        return { ...log, snapshot: snapshotFromMap };
      }
      return log;
    })
    .filter((log) => {
      const matchesSearch =
        (log.plateNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.cameraName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.vehicleDetails || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = matchOnly ? (log.isHotlistMatch || log.crimeMatch) : true;
      const matchesPending = pendingOnly ? isReviewable(log.status) : true;
      const matchesNode = nodeFilter !== '' ? String(log.nodeId ?? 0) === nodeFilter : true;
      const matchesType = vehicleTypeFilter ? (log.vehicleType || '') === vehicleTypeFilter : true;
      const matchesStatus = statusFilter ? log.status === statusFilter : true;
      const matchesFrom = dateFrom ? logDate(log) >= dateFrom : true;
      const matchesTo = dateTo ? logDate(log) <= dateTo : true;
      return matchesSearch && matchesFilter && matchesPending &&
        matchesNode && matchesType && matchesStatus && matchesFrom && matchesTo;
    });

  const hasSnapshot = (log) => log.snapshot && log.snapshot.trim() !== '' && log.snapshot.startsWith('data:');
  const hasActiveFilters = !!(nodeFilter || vehicleTypeFilter || statusFilter || dateFrom || dateTo || searchTerm || matchOnly || pendingOnly);

  const clearFilters = () => {
    setNodeFilter('');
    setVehicleTypeFilter('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setSearchTerm('');
    setMatchOnly(false);
    setPendingOnly(false);
  };

  return (
    <div className="detection-logs-container">
      <div className="section-header flex flex-wrap justify-between items-center gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="text-cyan-400" size={24} />
            SURVEILLANCE DETECTION LOGS & ANPR AUDIT TRAIL
          </h2>
          <p className="text-xs text-slate-400">
            Real detection records from the AI pipeline — filtered per CCTV node, no seed or mock data
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-800/80 px-3 py-2 rounded-lg border border-slate-700">
            <input type="checkbox" checked={matchOnly} onChange={(e) => setMatchOnly(e.target.checked)} className="checkbox" />
            <span className="font-semibold text-red-400">Hotlist Matches Only</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-800/80 px-3 py-2 rounded-lg border border-slate-700">
            <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} className="checkbox" />
            <span className="font-semibold text-amber-400">Pending Review Only</span>
          </label>
        </div>
      </div>

      {/* History filters */}
      <div className="card bg-slate-900 border-slate-800 p-4 mb-6 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by plate number, camera, or vehicle description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10 bg-slate-950 border-slate-700 text-white rounded-lg w-full text-xs py-2.5"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <label className="text-[11px] text-slate-400 flex flex-col gap-1">
            CCTV Node
            <select
              value={nodeFilter}
              onChange={(e) => setNodeFilter(e.target.value)}
              className="input bg-slate-950 border-slate-700 text-white rounded-lg text-xs py-2"
            >
              <option value="">All Nodes</option>
              <option value="0">No Node / Legacy</option>
              {nodes.map(n => (
                <option key={n.nodeId} value={String(n.nodeId)}>Node {n.nodeId} — {n.cameraName}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-slate-400 flex flex-col gap-1">
            Vehicle Type
            <select
              value={vehicleTypeFilter}
              onChange={(e) => setVehicleTypeFilter(e.target.value)}
              className="input bg-slate-950 border-slate-700 text-white rounded-lg text-xs py-2"
            >
              <option value="">All Types</option>
              {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-slate-400 flex flex-col gap-1">
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input bg-slate-950 border-slate-700 text-white rounded-lg text-xs py-2"
            >
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-slate-400 flex flex-col gap-1">
            From Date
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input bg-slate-950 border-slate-700 text-white rounded-lg text-xs py-2"
            />
          </label>
          <label className="text-[11px] text-slate-400 flex flex-col gap-1">
            To Date
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input bg-slate-950 border-slate-700 text-white rounded-lg text-xs py-2"
            />
          </label>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>{filteredLogs.length} of {localLogs.length} records</span>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-cyan-400 hover:text-cyan-300 font-semibold">
              CLEAR ALL FILTERS
            </button>
          )}
        </div>
      </div>

      <div className="card bg-slate-900 border-slate-800 overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="table-dark w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Node</th>
                <th className="p-3">Camera</th>
                <th className="p-3">Track</th>
                <th className="p-3">Vehicle Details</th>
                <th className="p-3 whitespace-nowrap">Number Plate</th>
                <th className="p-3">Confidence</th>
                <th className="p-3">Crime Match</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-500 text-xs">
                    <FileText size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="font-medium text-slate-400">No detection logs match the current filters</p>
                    <p className="text-slate-600 mt-1">Detection records will appear here after scanning frames through the AI pipeline.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id || log.logId}
                    className={`hover:bg-slate-800/50 transition-colors ${(log.isHotlistMatch || log.crimeMatch) ? 'bg-red-950/20' : ''}`}
                  >
                    <td className="font-mono text-xs text-slate-300 p-3 whitespace-nowrap">{log.timestamp}</td>
                    <td className="p-3">
                      <span className="font-mono text-[11px] text-cyan-400 font-bold">
                        {log.nodeId > 0 ? `NODE-${log.nodeId}` : '—'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <Camera size={12} className="text-cyan-400 shrink-0" />
                        <span className="text-[11px] text-slate-300 truncate max-w-[120px]">{log.cameraName || log.cameraId || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-[11px] text-indigo-300">
                        {log.trackId != null ? `T${log.trackId}` : '—'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-200 text-[11px]">{log.vehicleDetails || 'N/A'}</div>
                      {log.vehicleType && (
                        <div className="text-[10px] text-slate-500 font-mono">{log.vehicleType}</div>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs whitespace-nowrap ${(log.isHotlistMatch || log.crimeMatch) ? 'bg-red-950 text-red-300 border border-red-500/40' : 'bg-slate-800 text-slate-200'}`}>
                          {log.plateNumber}
                        </span>
                        {log.plateNumber && log.plateNumber !== 'NO_PLATE_DETECTED' && (
                          <button
                            onClick={(e) => openObservations(log.plateNumber, e)}
                            className="text-slate-500 hover:text-cyan-400 shrink-0"
                            title="View cross-node observation history for this plate"
                          >
                            <History size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-xs text-emerald-400 font-semibold">{log.confidence}%</span>
                    </td>
                    <td className="p-3">
                      {(log.isHotlistMatch || log.crimeMatch) ? (
                        <span className="badge bg-red-950/90 text-red-300 border border-red-500/50 px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 w-fit">
                          <AlertTriangle size={12} /> {log.threatLevel || 'MATCH'}
                        </span>
                      ) : log.plateNumber === 'NO_PLATE_DETECTED' ? (
                        <span className="badge bg-slate-800/80 text-slate-400 border border-slate-700 px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 w-fit">
                          <Shield size={12} /> No Plate
                        </span>
                      ) : (
                        <span className="badge bg-amber-950/60 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 w-fit">
                          <CheckCircle size={12} /> Under Review
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {log.status === 'CONFIRMED_BY_OFFICER' ? (
                        <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1"><UserCheck size={13} /> Confirmed</span>
                      ) : log.status === 'REJECTED_BY_OFFICER' ? (
                        <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><UserX size={13} /> Rejected</span>
                      ) : log.status === 'DISPATCHED' ? (
                        <span className="text-[11px] font-bold text-red-400 flex items-center gap-1"><Radar size={13} /> Dispatched</span>
                      ) : isReviewable(log.status) ? (
                        <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1 animate-pulse"><Clock size={13} /> Pending Review</span>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1"><CheckCircle size={13} /> Cleared</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setSelectedLog(log)} className="btn bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded" title="View Details & Snapshot">
                          <Eye size={15} />
                        </button>
                        {isReviewable(log.status) && (
                          <>
                            <button onClick={(e) => handleApprove(log.logId || log.id, e)} className="btn bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] px-2 py-1 rounded font-bold">Confirm</button>
                            <button onClick={(e) => handleReject(log.logId || log.id, e)} className="btn bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] px-2 py-1 rounded border border-slate-700 font-bold">Reject</button>
                          </>
                        )}
                        {log.status === 'CONFIRMED_BY_OFFICER' && onOpenDispatch && (
                          <button onClick={() => onOpenDispatch(log)} className="btn bg-red-600 hover:bg-red-500 text-white text-[11px] px-2 py-1 rounded font-bold">Dispatch</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Observation history modal */}
      {obsPlate && (
        <div className="modal-backdrop fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center p-4 z-50">
          <div className="modal-card bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 font-bold text-white text-base">
                <History className="text-cyan-400" size={20} />
                <span>OBSERVATION HISTORY — <span className="font-mono text-amber-400 whitespace-nowrap">{obsPlate}</span></span>
              </div>
              <button onClick={() => setObsPlate(null)} className="btn text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            {obsLoading ? (
              <div className="text-center py-8 text-slate-400 text-xs">Loading observations across all CCTV nodes...</div>
            ) : observations.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">No observations recorded for this plate.</div>
            ) : (
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-800">
                  <tr>
                    <th className="py-2">Time</th>
                    <th className="py-2">Node</th>
                    <th className="py-2">Camera</th>
                    <th className="py-2">Track</th>
                    <th className="py-2">Match</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {observations.map((o) => (
                    <tr key={o.id || o.logId}>
                      <td className="py-2 font-mono text-[11px]">{o.timestamp}</td>
                      <td className="py-2 font-mono text-cyan-400">{o.nodeId > 0 ? `NODE-${o.nodeId}` : '—'}</td>
                      <td className="py-2 text-[11px]">{o.cameraName}</td>
                      <td className="py-2 font-mono text-indigo-300">{o.trackId != null ? `T${o.trackId}` : '—'}</td>
                      <td className="py-2">
                        {(o.isHotlistMatch || o.crimeMatch)
                          ? <span className="text-red-400 font-bold">MATCH</span>
                          : <span className="text-emerald-400">CLEARED</span>}
                      </td>
                      <td className="py-2 text-[11px]">{o.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="text-[10px] text-slate-500">
              Each node observation is stored separately — sightings from different CCTV nodes are never merged.
            </p>
          </div>
        </div>
      )}

      {/* Detail / Snapshot Modal */}
      {selectedLog && (
        <div className="modal-backdrop fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center p-4 z-50">
          <div className="modal-card bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 font-bold text-white text-base">
                <Shield className="text-cyan-400" size={20} />
                <span>DETECTION EVENT DETAILS</span>
              </div>
              <button onClick={() => setSelectedLog(null)} className="btn text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Snapshot */}
              {hasSnapshot(selectedLog) ? (
                <div className="relative rounded-lg overflow-hidden bg-black aspect-video border border-slate-700">
                  <img src={selectedLog.snapshot} alt={`Frame: ${selectedLog.plateNumber}`} className="w-full h-full object-cover" />
                  <div className="absolute top-3 left-3 bg-black/80 backdrop-blur px-2.5 py-1 rounded text-xs font-mono font-bold text-amber-400 border border-amber-500/50">
                    PLATE: {selectedLog.plateNumber}
                  </div>
                  <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur px-2.5 py-1 rounded text-xs text-emerald-400 font-mono">
                    CONFIDENCE: {selectedLog.confidence}%
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-8 flex flex-col items-center justify-center text-center">
                  <ImageOff size={40} className="text-slate-600 mb-3" />
                  <p className="text-sm text-slate-400 font-medium">No captured frame available</p>
                  <p className="text-xs text-slate-600 mt-1">This detection was logged before snapshot storage was enabled, or the frame was not saved.</p>
                </div>
              )}

              {/* Data Grid */}
              <div className="grid grid-cols-2 gap-3 bg-slate-800/60 p-4 rounded-lg border border-slate-700 text-xs">
                <div>
                  <span className="text-slate-400 block">Log ID</span>
                  <span className="font-mono font-bold text-white">{selectedLog.logId}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Timestamp</span>
                  <span className="font-mono text-cyan-300">{selectedLog.timestamp}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">CCTV Node</span>
                  <span className="font-mono font-bold text-cyan-400">
                    {selectedLog.nodeId > 0 ? `NODE-${selectedLog.nodeId}` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Track / Session</span>
                  <span className="font-mono text-indigo-300 text-[10px] break-all">
                    {selectedLog.trackId != null ? `T${selectedLog.trackId}` : '—'} | {selectedLog.sessionId || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Camera Node</span>
                  <span className="font-semibold text-white">{selectedLog.cameraName || selectedLog.cameraId || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Location</span>
                  <span className="font-semibold text-slate-200">{selectedLog.location || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Vehicle Details</span>
                  <span className="font-semibold text-slate-200">{selectedLog.vehicleDetails || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Vehicle Type</span>
                  <span className="font-semibold text-slate-200">{selectedLog.vehicleType || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Plate Number</span>
                  <span className="font-mono font-bold text-amber-400 whitespace-nowrap">{selectedLog.plateNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Confidence</span>
                  <span className="font-mono text-emerald-400 font-bold">{selectedLog.confidence}%</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Validation Status</span>
                  <span className="font-bold text-amber-400">{selectedLog.status || 'N/A'}</span>
                </div>
              </div>

              {isReviewable(selectedLog.status) && (
                <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-xs text-slate-300 font-bold">
                    <AlertTriangle className="text-amber-400" size={18} />
                    <span>Requires authorized officer verification — Confirm or Reject this detection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => handleApprove(selectedLog.logId || selectedLog.id)}
                      className="btn bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2 px-4 rounded-lg font-bold flex items-center gap-1.5 flex-1 justify-center">
                      <UserCheck size={16} /> Confirm Detection
                    </button>
                    <button type="button" onClick={() => handleReject(selectedLog.logId || selectedLog.id)}
                      className="btn bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-2 px-4 rounded-lg font-bold flex items-center gap-1.5 flex-1 justify-center border border-slate-700">
                      <UserX size={16} /> Reject Detection
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
