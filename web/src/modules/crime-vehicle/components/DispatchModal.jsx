import React, { useState } from 'react';
import { Shield, Radio, Navigation, CheckCircle2, X, AlertTriangle } from 'lucide-react';

export default function DispatchModal({ isOpen, onClose, detectionLog, patrolUnits, onDispatch }) {
  const [selectedUnitId, setSelectedUnitId] = useState(patrolUnits[0]?.id || '');
  const [dispatching, setDispatching] = useState(false);
  const [dispatchedSuccess, setDispatchedSuccess] = useState(false);

  if (!isOpen || !detectionLog) return null;

  const handleConfirmDispatch = async () => {
    setDispatching(true);
    await new Promise(r => setTimeout(r, 1000));
    onDispatch(selectedUnitId, detectionLog.id);
    setDispatching(false);
    setDispatchedSuccess(true);
    setTimeout(() => {
      setDispatchedSuccess(false);
      onClose();
    }, 1800);
  };

  const selectedUnit = patrolUnits.find(u => u.id === selectedUnitId);

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div className="flex items-center gap-2 text-red-500 font-bold">
            <Radio className="animate-pulse text-red-500" size={22} />
            <span>EMERGENCY PATROL DISPATCH CONSOLE</span>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X size={20} />
          </button>
        </div>

        {dispatchedSuccess ? (
          <div className="dispatch-success-view">
            <CheckCircle2 size={64} className="text-emerald-400 animate-bounce mb-3" />
            <h3 className="text-xl font-bold text-emerald-400">PATROL UNIT DISPATCHED!</h3>
            <p className="text-slate-300 text-sm mt-1">
              <strong>{selectedUnit?.callsign}</strong> is en-route to <strong>{detectionLog.cameraName}</strong>.
            </p>
            <div className="eta-badge mt-4">
              Estimated Arrival: {selectedUnit?.eta || '2-4 mins'}
            </div>
          </div>
        ) : (
          <div className="modal-body">
            {/* Alert Summary Box */}
            <div className="alert-summary-box border-red-500/40 bg-red-950/20">
              <div className="flex justify-between items-start">
                <div>
                  <span className="badge badge-critical">TARGET DETECTED</span>
                  <h4 className="text-lg font-bold text-white mt-1">{detectionLog.plateNumber}</h4>
                  <p className="text-xs text-slate-300">{detectionLog.vehicleDetails}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Location</span>
                  <div className="text-sm font-semibold text-red-400">{detectionLog.cameraName}</div>
                  <div className="text-xs text-slate-400">{detectionLog.timestamp}</div>
                </div>
              </div>
            </div>

            {/* Select Unit */}
            <div className="form-group mt-4">
              <label className="form-label font-semibold text-slate-200">Select Intercept Patrol Unit</label>
              <div className="patrol-list-select grid gap-2 mt-2">
                {patrolUnits.map(unit => (
                  <div
                    key={unit.id}
                    onClick={() => setSelectedUnitId(unit.id)}
                    className={`patrol-unit-card ${selectedUnitId === unit.id ? 'active' : ''}`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${selectedUnitId === unit.id ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400'}`}>
                          <Shield size={20} />
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm">{unit.callsign}</div>
                          <div className="text-xs text-slate-400">{unit.leadOfficer} &bull; {unit.sector}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`badge ${unit.status === 'AVAILABLE' ? 'badge-active' : 'badge-warn'}`}>
                          {unit.status}
                        </span>
                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                          <Navigation size={12} /> {unit.distanceToAlert} ({unit.eta})
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dispatch Note */}
            <div className="text-xs text-slate-400 bg-slate-800/60 p-3 rounded-lg border border-slate-700 flex items-center gap-2 mt-4">
              <AlertTriangle size={16} className="text-amber-400 shrink-0" />
              <span>High-speed pursuit mode & GPS track sync will be transmitted directly to unit dashboard.</span>
            </div>

            {/* Modal Actions */}
            <div className="modal-actions mt-6">
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDispatch}
                disabled={dispatching || !selectedUnitId}
                className="btn btn-danger flex items-center gap-2"
              >
                <Radio size={18} />
                {dispatching ? 'Transmitting Dispatch...' : `Dispatch ${selectedUnit?.callsign || 'Unit'}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
