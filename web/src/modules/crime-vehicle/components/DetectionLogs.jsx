import React, { useState } from 'react';
import {
  FileText,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Shield,
  X,
  Gauge,
  Compass
} from 'lucide-react';

export default function DetectionLogs({ logs, onOpenDispatch }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [matchOnly, setMatchOnly] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.cameraName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.vehicleDetails.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = matchOnly ? log.isHotlistMatch : true;

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="detection-logs-container">
      {/* Header */}
      <div className="section-header flex flex-wrap justify-between items-center gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="text-cyan-400" size={24} />
            SURVEILLANCE DETECTION LOGS & ANPR AUDIT TRAIL
          </h2>
          <p className="text-xs text-slate-400">
            Searchable historical audit record of optical license plate recognitions and alert triggers
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-800/80 px-3 py-2 rounded-lg border border-slate-700">
            <input
              type="checkbox"
              checked={matchOnly}
              onChange={(e) => setMatchOnly(e.target.checked)}
              className="checkbox"
            />
            <span className="font-semibold text-red-400">Show Hotlist Matches Only</span>
          </label>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card bg-slate-900 border-slate-800 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search detection logs by plate number, location node, or vehicle description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card bg-slate-900 border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-dark">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>License Plate</th>
                <th>Camera Node / Location</th>
                <th>OCR Conf.</th>
                <th>Speed & Direction</th>
                <th>Hotlist Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 text-xs">
                    No detection logs found matching query filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className={`hover:bg-slate-800/50 transition-colors ${
                      log.isHotlistMatch ? 'bg-red-950/20' : ''
                    }`}
                  >
                    <td className="font-mono text-xs text-slate-300">
                      {log.timestamp}
                    </td>

                    <td>
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded text-sm ${
                          log.isHotlistMatch
                            ? 'bg-red-950 text-red-300 border border-red-500/40'
                            : 'bg-slate-800 text-slate-200'
                        }`}
                      >
                        {log.plateNumber}
                      </span>
                    </td>

                    <td>
                      <div className="text-xs font-semibold text-slate-200">{log.cameraName}</div>
                      <div className="text-[11px] text-slate-400">{log.location}</div>
                    </td>

                    <td>
                      <span className="font-mono text-xs text-emerald-400 font-semibold">
                        {log.confidence}%
                      </span>
                    </td>

                    <td className="text-xs text-slate-300">
                      <div>{log.speed}</div>
                      <div className="text-[11px] text-slate-400">{log.direction}</div>
                    </td>

                    <td>
                      {log.isHotlistMatch ? (
                        <span className="badge badge-critical flex items-center gap-1 w-fit">
                          <AlertTriangle size={12} /> {log.threatLevel} MATCH
                        </span>
                      ) : (
                        <span className="badge badge-emerald flex items-center gap-1 w-fit">
                          <CheckCircle size={12} /> CLEARED
                        </span>
                      )}
                    </td>

                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="btn-icon"
                          title="Inspect Snapshot & Details"
                        >
                          <Eye size={16} />
                        </button>

                        {log.isHotlistMatch && (
                          <button
                            onClick={() => onOpenDispatch(log)}
                            className="btn btn-danger-ghost btn-xs text-[11px] flex items-center gap-1"
                          >
                            Dispatch
                          </button>
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

      {/* Snapshot Inspection Modal */}
      {selectedLog && (
        <div className="modal-backdrop">
          <div className="modal-card max-w-2xl">
            <div className="modal-header">
              <div className="flex items-center gap-2 font-bold text-white">
                <Shield className="text-cyan-400" size={20} />
                <span>DETECTION EVENT SNAPSHOT INSPECTION</span>
              </div>
              <button onClick={() => setSelectedLog(null)} className="btn-icon">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body space-y-4">
              {/* Snapshot Image */}
              <div className="relative rounded-lg overflow-hidden bg-black aspect-video border border-slate-700">
                <img
                  src={selectedLog.snapshot}
                  alt={selectedLog.plateNumber}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-black/80 backdrop-blur px-2.5 py-1 rounded text-xs font-mono font-bold text-amber-400 border border-amber-500/50">
                  PLATE: {selectedLog.plateNumber}
                </div>
                <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur px-2.5 py-1 rounded text-xs text-emerald-400 font-mono">
                  ANPR CONFIDENCE: {selectedLog.confidence}%
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 gap-3 bg-slate-800/60 p-4 rounded-lg border border-slate-700 text-xs">
                <div>
                  <span className="text-slate-400 block">Camera Node</span>
                  <span className="font-semibold text-white">{selectedLog.cameraName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Exact Timestamp</span>
                  <span className="font-mono text-cyan-300">{selectedLog.timestamp}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Vehicle Description</span>
                  <span className="font-semibold text-slate-200">{selectedLog.vehicleDetails}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Telemetry</span>
                  <span className="font-mono text-slate-200">{selectedLog.speed} ({selectedLog.direction})</span>
                </div>
              </div>

              {selectedLog.isHotlistMatch && (
                <div className="p-3 bg-red-950/50 border border-red-500/60 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-red-300">
                    <AlertTriangle className="text-red-400" size={18} />
                    <span>Matched against Hotlist DB: <strong>{selectedLog.threatLevel} Threat</strong></span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const currentLog = selectedLog;
                      setSelectedLog(null);
                      onOpenDispatch(currentLog);
                    }}
                    className="btn btn-danger btn-xs"
                  >
                    Dispatch Intercept Patrol
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
