import React, { useState } from 'react';
import {
  ShieldAlert,
  Plus,
  Search,
  Filter,
  Car,
  AlertOctagon,
  Clock,
  MapPin,
  FileText,
  X,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export default function HotlistManager({ hotlist, onAddHotlist, onUpdateStatus, onOpenDispatch }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // New vehicle form state
  const [formData, setFormData] = useState({
    plateNumber: '',
    makeModel: '',
    color: '',
    threatLevel: 'HIGH',
    incidentType: '',
    lastSeenCamera: 'Main St & 5th Ave',
    ownerName: '',
    notes: '',
    image: ''
  });

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.plateNumber || !formData.incidentType) return;

    await onAddHotlist(formData);
    setShowAddModal(false);
    setFormData({
      plateNumber: '',
      makeModel: '',
      color: '',
      threatLevel: 'HIGH',
      incidentType: '',
      lastSeenCamera: 'Main St & 5th Ave',
      ownerName: '',
      notes: '',
      image: ''
    });
  };

  const filteredList = hotlist.filter((item) => {
    const matchesSearch =
      item.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.makeModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.incidentType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.ownerName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSeverity = severityFilter === 'ALL' || item.threatLevel === severityFilter;
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  return (
    <div className="hotlist-manager-container">
      {/* Header Bar */}
      <div className="section-header flex flex-wrap justify-between items-center gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="text-red-500" size={24} />
            WANTED VEHICLE HOTLIST & BLACKLIST DATABASE
          </h2>
          <p className="text-xs text-slate-400">
            Active criminal hotlist registry synced across all smart city ANPR surveillance nodes
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-danger flex items-center gap-2 px-4 py-2"
        >
          <Plus size={18} /> Register Wanted Vehicle
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="card bg-slate-900 border-slate-800 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by license plate, make, model, suspect or incident..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>

          <div>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="input"
            >
              <option value="ALL">All Threat Severities</option>
              <option value="CRITICAL">Critical Threat Only</option>
              <option value="HIGH">High Threat</option>
              <option value="MEDIUM">Medium Threat</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input"
            >
              <option value="ALL">All Statuses</option>
              <option value="WANTED">WANTED</option>
              <option value="SEARCHING">SEARCHING</option>
              <option value="INTERCEPTED">INTERCEPTED</option>
            </select>
          </div>
        </div>
      </div>

      {/* Hotlist Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredList.map((item) => (
          <div
            key={item.id}
            className={`card bg-slate-900 border p-5 transition-all relative ${
              item.threatLevel === 'CRITICAL'
                ? 'border-red-500/60 shadow-lg shadow-red-950/20'
                : item.threatLevel === 'HIGH'
                ? 'border-amber-500/50'
                : 'border-slate-800'
            }`}
          >
            <div className="flex gap-4">
              <img
                src={item.image || 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80'}
                alt={item.makeModel}
                className="w-32 h-28 object-cover rounded-lg border border-slate-800 shrink-0"
              />

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono text-xl font-extrabold text-amber-400 bg-slate-950 px-2 py-0.5 rounded border border-amber-500/30">
                      {item.plateNumber}
                    </span>
                    <div className="text-sm font-semibold text-white mt-2 truncate">
                      {item.makeModel}
                    </div>
                  </div>

                  <span
                    className={`badge ${
                      item.threatLevel === 'CRITICAL'
                        ? 'badge-critical'
                        : item.threatLevel === 'HIGH'
                        ? 'badge-warn'
                        : 'badge-slate'
                    }`}
                  >
                    {item.threatLevel} THREAT
                  </span>
                </div>

                <div className="text-xs text-red-400 font-bold mt-2 flex items-center gap-1.5">
                  <AlertOctagon size={14} /> {item.incidentType}
                </div>
              </div>
            </div>

            {/* Incident Details Grid */}
            <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800 text-xs text-slate-300">
              <div>
                <span className="text-slate-500 block text-[11px]">Owner / Suspect</span>
                <span className="font-medium text-slate-200">{item.ownerName || 'Unknown'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Wanted Since</span>
                <span className="font-mono text-slate-300">{item.wantedSince}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 block text-[11px]">Last Seen Node</span>
                <span className="font-medium text-cyan-400 flex items-center gap-1">
                  <MapPin size={12} /> {item.lastSeenCamera}
                </span>
              </div>
              {item.notes && (
                <div className="col-span-2 bg-slate-950/60 p-2 rounded border border-slate-800 text-slate-400 text-[11px]">
                  <strong>Notes:</strong> {item.notes}
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Status:</span>
                <select
                  value={item.status}
                  onChange={(e) => onUpdateStatus(item.id, e.target.value)}
                  className="select-xs font-bold text-xs rounded bg-slate-800 border-slate-700 text-slate-200"
                >
                  <option value="WANTED">WANTED</option>
                  <option value="SEARCHING">SEARCHING</option>
                  <option value="INTERCEPTED">INTERCEPTED</option>
                </select>
              </div>

              {item.status !== 'INTERCEPTED' && (
                <button
                  onClick={() =>
                    onOpenDispatch({
                      id: `DISP-${item.id}`,
                      plateNumber: item.plateNumber,
                      cameraName: item.lastSeenCamera,
                      vehicleDetails: item.makeModel,
                      timestamp: item.wantedSince
                    })
                  }
                  className="btn btn-danger-ghost btn-sm text-xs flex items-center gap-1"
                >
                  <AlertTriangle size={14} /> Dispatch Intercept
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Wanted Vehicle Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <Car className="text-red-500" size={20} />
                REGISTER WANTED VEHICLE TO HOTLIST
              </h3>
              <button onClick={() => setShowAddModal(false)} className="btn-icon">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="modal-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">License Plate Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. WP CAD-7829"
                    value={formData.plateNumber}
                    onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value.toUpperCase() })}
                    className="input font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="form-label">Threat Severity Level *</label>
                  <select
                    value={formData.threatLevel}
                    onChange={(e) => setFormData({ ...formData, threatLevel: e.target.value })}
                    className="input"
                  >
                    <option value="CRITICAL">CRITICAL (Armed / Violence)</option>
                    <option value="HIGH">HIGH (Stolen / Major Crime)</option>
                    <option value="MEDIUM">MEDIUM (Traffic Felony / Evading)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Vehicle Make & Model</label>
                  <input
                    type="text"
                    placeholder="e.g. Toyota Land Cruiser"
                    value={formData.makeModel}
                    onChange={(e) => setFormData({ ...formData, makeModel: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="form-label">Vehicle Color</label>
                  <input
                    type="text"
                    placeholder="e.g. Obsidian Black"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Incident Type / Reason *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Armed Bank Robbery, Hit & Run, Hijacking"
                  value={formData.incidentType}
                  onChange={(e) => setFormData({ ...formData, incidentType: e.target.value })}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Owner / Suspect Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Unknown / Suspect Alias"
                    value={formData.ownerName}
                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="form-label">Vehicle Image URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Tactical Notes & Instructions</label>
                <textarea
                  rows={2}
                  placeholder="Additional observations, armed suspect warnings..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input"
                />
              </div>

              <div className="modal-actions pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Save & Sync to Hotlist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
