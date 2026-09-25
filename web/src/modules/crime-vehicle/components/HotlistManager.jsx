import React, { useState, useRef } from 'react';
import {
  ShieldAlert,
  Plus,
  Search,
  Car,
  AlertOctagon,
  MapPin,
  X,
  AlertTriangle,
  Trash2,
  Pencil,
  Upload,
  Image
} from 'lucide-react';

export default function HotlistManager({ hotlist, onAddHotlist, onUpdateStatus, onDeleteVehicle, onEditVehicle, onOpenDispatch }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const addFileInputRef = useRef(null);
  const editFileInputRef = useRef(null);

  const emptyForm = {
    plateNumber: '',
    makeModel: '',
    color: '',
    threatLevel: 'HIGH',
    incidentType: '',
    lastSeenCamera: 'Main St & 5th Ave',
    ownerName: '',
    notes: '',
    image: ''
  };

  const [formData, setFormData] = useState(emptyForm);
  const [editFormData, setEditFormData] = useState(emptyForm);
  const [addErrors, setAddErrors] = useState({});
  const [editErrors, setEditErrors] = useState({});

  const normalizePlate = (p) => (p || '').trim().toUpperCase().replace(/\s+/g, '');
  const VALID_THREAT_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM'];

  const validateForm = (data, excludeId = null) => {
    const errs = {};

    const plate = (data.plateNumber || '').trim();
    if (!plate) errs.plateNumber = 'License plate number is required';
    else if (plate.length < 3) errs.plateNumber = 'Plate must be at least 3 characters';
    else if (plate.length > 12) errs.plateNumber = 'Plate must be at most 12 characters';
    else if (!/^[A-Z0-9\s\-]+$/i.test(plate)) errs.plateNumber = 'Plate can only contain letters, numbers, spaces and dashes';
    else if (hotlist.some(v => normalizePlate(v.plateNumber) === normalizePlate(plate) &&
      String(v.vehicleId || v.id) !== String(excludeId ?? ''))) {
      errs.plateNumber = 'This plate is already registered on the hotlist';
    }

    const makeModel = (data.makeModel || '').trim();
    if (!makeModel) errs.makeModel = 'Vehicle make & model is required';
    else if (makeModel.length < 2) errs.makeModel = 'Make & model must be at least 2 characters';
    else if (makeModel.length > 80) errs.makeModel = 'Make & model must be at most 80 characters';
    else if (!/^[A-Za-z0-9\s&'.\-]+$/.test(makeModel)) errs.makeModel = 'Make & model contains invalid characters';

    const color = (data.color || '').trim();
    if (!color) errs.color = 'Vehicle color is required';
    else if (color.length < 2) errs.color = 'Color must be at least 2 characters';
    else if (color.length > 32) errs.color = 'Color must be at most 32 characters';
    else if (!/^[A-Za-z\s\-/]+$/.test(color)) errs.color = 'Color can only contain letters, spaces, hyphens and slashes';

    const incidentType = (data.incidentType || '').trim();
    if (!incidentType) errs.incidentType = 'Incident type is required';
    else if (incidentType.length < 3) errs.incidentType = 'Incident type must be at least 3 characters';
    else if (incidentType.length > 120) errs.incidentType = 'Incident type must be at most 120 characters';

    const ownerName = (data.ownerName || '').trim();
    if (!ownerName) errs.ownerName = 'Owner / suspect name is required';
    else if (ownerName.length < 2) errs.ownerName = 'Owner name must be at least 2 characters';
    else if (ownerName.length > 60) errs.ownerName = 'Owner name must be at most 60 characters';
    else if (!/^[A-Za-z\s.'\-]+$/.test(ownerName)) errs.ownerName = 'Owner name can only contain letters, spaces, hyphens, apostrophes and periods';

    if (!VALID_THREAT_LEVELS.includes(data.threatLevel)) errs.threatLevel = 'Please select a valid threat level';

    const notes = (data.notes || '').trim();
    if (notes.length > 500) errs.notes = 'Notes must be at most 500 characters';

    if (!data.image) errs.image = 'Vehicle image is required';
    else if (!data.image.startsWith('data:image/')) errs.image = 'Vehicle image must be a valid image file';

    return errs;
  };

  const handleImageUpload = (e, isEdit = false) => {
    const file = e.target.files?.[0];
    const setErrors = isEdit ? setEditErrors : setAddErrors;
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, image: 'File must be an image (JPG, PNG, WEBP...)' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, image: 'Image must be less than 5MB' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (isEdit) {
        setEditFormData(prev => ({ ...prev, image: ev.target.result }));
        setEditErrors(prev => ({ ...prev, image: '' }));
      } else {
        setFormData(prev => ({ ...prev, image: ev.target.result }));
        setAddErrors(prev => ({ ...prev, image: '' }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const buildPayload = (data) => ({
    ...data,
    plateNumber: (data.plateNumber || '').trim().toUpperCase(),
    makeModel: (data.makeModel || '').trim(),
    color: (data.color || '').trim(),
    incidentType: (data.incidentType || '').trim(),
    ownerName: (data.ownerName || '').trim(),
    notes: (data.notes || '').trim()
  });

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const errs = validateForm(formData);
    setAddErrors(errs);
    if (Object.keys(errs).length > 0) return;
    await onAddHotlist(buildPayload(formData));
    setShowAddModal(false);
    setFormData(emptyForm);
    setAddErrors({});
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const errs = validateForm(editFormData, editingVehicle?.vehicleId || editingVehicle?.id);
    setEditErrors(errs);
    if (Object.keys(errs).length > 0) return;
    await onEditVehicle(editingVehicle.vehicleId || editingVehicle.id, buildPayload(editFormData));
    setShowEditModal(false);
    setEditingVehicle(null);
    setEditFormData(emptyForm);
    setEditErrors({});
  };

  const openEditModal = (item) => {
    setEditingVehicle(item);
    setEditFormData({
      plateNumber: item.plateNumber || '',
      makeModel: item.makeModel || '',
      color: item.color || '',
      threatLevel: item.threatLevel || 'HIGH',
      incidentType: item.incidentType || '',
      lastSeenCamera: item.lastSeenCamera || '',
      ownerName: item.ownerName || '',
      notes: item.notes || '',
      image: item.image || ''
    });
    setEditErrors({});
    setShowEditModal(true);
  };

  const filteredList = hotlist.filter((item) => {
    const matchesSearch =
      (item.plateNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.makeModel || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.incidentType || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.ownerName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = severityFilter === 'ALL' || item.threatLevel === severityFilter;
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const renderFormFields = (data, setData, errors, setErrors, isEdit) => (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">License Plate Number *</label>
          <input type="text" placeholder="e.g. WP CAD-7829" maxLength={12}
            value={data.plateNumber}
            onChange={(e) => {
              setData(prev => ({ ...prev, plateNumber: e.target.value.toUpperCase() }));
              if (errors.plateNumber) setErrors(prev => ({ ...prev, plateNumber: '' }));
            }}
            className={`input font-mono uppercase ${errors.plateNumber ? 'border-red-500 ring-1 ring-red-500/50' : ''}`} />
          {errors.plateNumber && <p className="text-red-400 text-[11px] mt-1">{errors.plateNumber}</p>}
        </div>
        <div>
          <label className="form-label">Threat Severity Level *</label>
          <select value={data.threatLevel}
            onChange={(e) => {
              setData(prev => ({ ...prev, threatLevel: e.target.value }));
              if (errors.threatLevel) setErrors(prev => ({ ...prev, threatLevel: '' }));
            }}
            className={`input ${errors.threatLevel ? 'border-red-500 ring-1 ring-red-500/50' : ''}`}>
            <option value="CRITICAL">CRITICAL (Armed / Violence)</option>
            <option value="HIGH">HIGH (Stolen / Major Crime)</option>
            <option value="MEDIUM">MEDIUM (Traffic Felony / Evading)</option>
          </select>
          {errors.threatLevel && <p className="text-red-400 text-[11px] mt-1">{errors.threatLevel}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Vehicle Make & Model *</label>
          <input type="text" placeholder="e.g. Toyota Land Cruiser" maxLength={80}
            value={data.makeModel}
            onChange={(e) => {
              setData(prev => ({ ...prev, makeModel: e.target.value }));
              if (errors.makeModel) setErrors(prev => ({ ...prev, makeModel: '' }));
            }}
            className={`input ${errors.makeModel ? 'border-red-500 ring-1 ring-red-500/50' : ''}`} />
          {errors.makeModel && <p className="text-red-400 text-[11px] mt-1">{errors.makeModel}</p>}
        </div>
        <div>
          <label className="form-label">Vehicle Color *</label>
          <input type="text" placeholder="e.g. Obsidian Black" maxLength={32}
            value={data.color}
            onChange={(e) => {
              setData(prev => ({ ...prev, color: e.target.value }));
              if (errors.color) setErrors(prev => ({ ...prev, color: '' }));
            }}
            className={`input ${errors.color ? 'border-red-500 ring-1 ring-red-500/50' : ''}`} />
          {errors.color && <p className="text-red-400 text-[11px] mt-1">{errors.color}</p>}
        </div>
      </div>
      <div>
        <label className="form-label">Incident Type / Reason *</label>
        <input type="text" placeholder="e.g. Armed Bank Robbery, Hit & Run" maxLength={120}
          value={data.incidentType}
          onChange={(e) => {
            setData(prev => ({ ...prev, incidentType: e.target.value }));
            if (errors.incidentType) setErrors(prev => ({ ...prev, incidentType: '' }));
          }}
          className={`input ${errors.incidentType ? 'border-red-500 ring-1 ring-red-500/50' : ''}`} />
        {errors.incidentType && <p className="text-red-400 text-[11px] mt-1">{errors.incidentType}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Owner / Suspect Name *</label>
          <input type="text" placeholder="e.g. Unknown / Suspect Alias" maxLength={60}
            value={data.ownerName}
            onChange={(e) => {
              setData(prev => ({ ...prev, ownerName: e.target.value }));
              if (errors.ownerName) setErrors(prev => ({ ...prev, ownerName: '' }));
            }}
            className={`input ${errors.ownerName ? 'border-red-500 ring-1 ring-red-500/50' : ''}`} />
          {errors.ownerName && <p className="text-red-400 text-[11px] mt-1">{errors.ownerName}</p>}
        </div>
        <div>
          <label className="form-label">Vehicle Image *</label>
          <input type="file" accept="image/*" ref={isEdit ? editFileInputRef : addFileInputRef}
            onChange={(e) => handleImageUpload(e, isEdit)}
            className="hidden" />
          <button type="button" onClick={() => (isEdit ? editFileInputRef : addFileInputRef).current?.click()}
            className={`btn bg-slate-800 hover:bg-slate-700 text-slate-300 w-full text-xs flex items-center gap-2 border py-2.5 rounded-lg ${errors.image ? 'border-red-500 ring-1 ring-red-500/50' : 'border-slate-700'}`}>
            <Upload size={14} />
            {data.image ? 'Change Image' : 'Upload Image from Device'}
          </button>
          {errors.image && <p className="text-red-400 text-[11px] mt-1">{errors.image}</p>}
          {data.image && (
            <div className="mt-2 relative">
              <img src={data.image} alt="Preview" className="w-full h-24 object-cover rounded-lg border border-slate-700" />
              <button type="button" onClick={() => {
                setData(prev => ({ ...prev, image: '' }));
                setErrors(prev => ({ ...prev, image: 'Vehicle image is required' }));
              }}
                className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5">
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
      <div>
        <label className="form-label">Tactical Notes & Instructions</label>
        <textarea rows={2} placeholder="Additional observations, armed suspect warnings..." maxLength={500}
          value={data.notes}
          onChange={(e) => {
            setData(prev => ({ ...prev, notes: e.target.value }));
            if (errors.notes) setErrors(prev => ({ ...prev, notes: '' }));
          }}
          className={`input ${errors.notes ? 'border-red-500 ring-1 ring-red-500/50' : ''}`} />
        {errors.notes && <p className="text-red-400 text-[11px] mt-1">{errors.notes}</p>}
      </div>
    </>
  );

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
          onClick={() => { setShowAddModal(true); setAddErrors({}); }}
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
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="input">
              <option value="ALL">All Threat Severities</option>
              <option value="CRITICAL">Critical Threat Only</option>
              <option value="HIGH">High Threat</option>
              <option value="MEDIUM">Medium Threat</option>
            </select>
          </div>
          <div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input">
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
            key={item.id || item.vehicleId}
            className={`card bg-slate-900 border p-5 transition-all relative ${
              item.threatLevel === 'CRITICAL'
                ? 'border-red-500/60 shadow-lg shadow-red-950/20'
                : item.threatLevel === 'HIGH'
                ? 'border-amber-500/50'
                : 'border-slate-800'
            }`}
          >
            <div className="flex gap-4">
              {item.image ? (
                <img src={item.image} alt={item.makeModel}
                  className="w-32 h-28 object-cover rounded-lg border border-slate-800 shrink-0" />
              ) : (
                <div className="w-32 h-28 rounded-lg border border-slate-700 bg-slate-800 flex flex-col items-center justify-center shrink-0">
                  <Image size={24} className="text-slate-600 mb-1" />
                  <span className="text-[10px] text-slate-500">No Image</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono text-xl font-extrabold text-amber-400 bg-slate-950 px-2 py-0.5 rounded border border-amber-500/30">
                      {item.plateNumber}
                    </span>
                    <div className="text-sm font-semibold text-white mt-2 truncate">{item.makeModel}</div>
                    {item.color && <div className="text-[11px] text-slate-400 mt-0.5">{item.color}</div>}
                  </div>
                  <span className={`badge ${
                    item.threatLevel === 'CRITICAL' ? 'badge-critical'
                    : item.threatLevel === 'HIGH' ? 'badge-warn' : 'badge-slate'
                  }`}>{item.threatLevel} THREAT</span>
                </div>
                <div className="text-xs text-red-400 font-bold mt-2 flex items-center gap-1.5">
                  <AlertOctagon size={14} /> {item.incidentType}
                </div>
              </div>
            </div>

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

            <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Status:</span>
                <select value={item.status}
                  onChange={(e) => onUpdateStatus(item.vehicleId || item.id, e.target.value)}
                  className="select-xs font-bold text-xs rounded bg-slate-800 border-slate-700 text-slate-200">
                  <option value="WANTED">WANTED</option>
                  <option value="SEARCHING">SEARCHING</option>
                  <option value="INTERCEPTED">INTERCEPTED</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                {item.status !== 'INTERCEPTED' && (
                  <button onClick={() => onOpenDispatch({
                    id: `DISP-${item.id}`, plateNumber: item.plateNumber,
                    cameraName: item.lastSeenCamera, vehicleDetails: item.makeModel, timestamp: item.wantedSince
                  })} className="btn btn-danger-ghost btn-sm text-xs flex items-center gap-1">
                    <AlertTriangle size={14} /> Dispatch
                  </button>
                )}
                <button onClick={() => openEditModal(item)}
                  className="btn bg-slate-800 hover:bg-cyan-950 text-cyan-400 hover:text-cyan-300 btn-sm text-xs flex items-center gap-1 border border-slate-700 hover:border-cyan-500/50">
                  <Pencil size={14} /> Edit
                </button>
                <button onClick={() => { if (window.confirm(`Delete ${item.plateNumber} from hotlist?`)) onDeleteVehicle(item.vehicleId || item.id); }}
                  className="btn bg-slate-800 hover:bg-red-950 text-red-400 hover:text-red-300 btn-sm text-xs flex items-center gap-1 border border-slate-700 hover:border-red-500/50">
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {filteredList.length === 0 && (
          <div className="col-span-2 text-center py-12">
            <ShieldAlert size={40} className="mx-auto mb-3 text-slate-600" />
            <p className="text-sm text-slate-400">No vehicles found</p>
            <p className="text-xs text-slate-600 mt-1">Add vehicles to the hotlist using the register button above</p>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <Car className="text-red-500" size={20} />
                REGISTER WANTED VEHICLE TO HOTLIST
              </h3>
              <button onClick={() => { setShowAddModal(false); setFormData(emptyForm); setAddErrors({}); }} className="btn-icon">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="modal-body space-y-4">
              {renderFormFields(formData, setFormData, addErrors, setAddErrors, false)}
              <div className="modal-actions pt-2">
                <button type="button" onClick={() => { setShowAddModal(false); setFormData(emptyForm); setAddErrors({}); }} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-danger">Save & Sync to Hotlist</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingVehicle && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <Pencil className="text-cyan-400" size={20} />
                EDIT VEHICLE — {editingVehicle.plateNumber}
              </h3>
              <button onClick={() => { setShowEditModal(false); setEditingVehicle(null); setEditErrors({}); }} className="btn-icon">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="modal-body space-y-4">
              {renderFormFields(editFormData, setEditFormData, editErrors, setEditErrors, true)}
              <div className="modal-actions pt-2">
                <button type="button" onClick={() => { setShowEditModal(false); setEditingVehicle(null); setEditErrors({}); }} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn bg-cyan-600 hover:bg-cyan-500 text-white">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
