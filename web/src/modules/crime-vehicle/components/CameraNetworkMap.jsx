import React, { useState } from 'react';
import { Map, MapPin, Radio, Shield, Camera, AlertTriangle, Eye, Layers, Compass } from 'lucide-react';

export default function CameraNetworkMap({ cameras, hotlist, onOpenDispatch }) {
  const [selectedCamera, setSelectedCamera] = useState(cameras[0]);
  const [showHotlistTrail, setShowHotlistTrail] = useState(true);

  // Selected hotlist target for tracking route
  const criticalHotlistItem = hotlist.find(h => h.threatLevel === 'CRITICAL') || hotlist[0];

  return (
    <div className="camera-map-container">
      {/* Header */}
      <div className="section-header flex flex-wrap justify-between items-center gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Map className="text-cyan-400" size={24} />
            SMART CITY ANPR SURVEILLANCE & SIGHTING MAP
          </h2>
          <p className="text-xs text-slate-400">
            Geospatial grid of active CCTV node sensors & suspect vehicle trajectory estimation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHotlistTrail(!showHotlistTrail)}
            className={`btn btn-sm ${showHotlistTrail ? 'btn-danger' : 'btn-secondary'}`}
          >
            <Radio size={14} className={showHotlistTrail ? 'animate-pulse' : ''} />
            {showHotlistTrail ? 'Tracking Target Trajectory' : 'Show Target Trail'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Canvas Card */}
        <div className="lg:col-span-2 card bg-slate-900 border-slate-800 p-4 relative overflow-hidden min-h-[500px] flex flex-col justify-between">
          {/* Simulated Dark Mode Tactical Vector Map Canvas */}
          <div className="absolute inset-0 bg-slate-950 city-map-canvas p-6">
            {/* City Grid Road Grid Vectors */}
            <svg className="w-full h-full opacity-30 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#06b6d4" strokeWidth="0.5" opacity="0.3" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Major Highway Artery Lines */}
              <line x1="20%" y1="20%" x2="80%" y2="80%" stroke="#0284c7" strokeWidth="3" strokeDasharray="6 4" />
              <line x1="15%" y1="85%" x2="85%" y2="15%" stroke="#0284c7" strokeWidth="3" strokeDasharray="6 4" />
              <circle cx="50%" cy="50%" r="20%" fill="none" stroke="#0369a1" strokeWidth="1.5" strokeDasharray="4 4" />

              {/* Hotlist Suspect Trajectory Line */}
              {showHotlistTrail && (
                <>
                  <path
                    d="M 22% 22% Q 35% 42% 42% 35% T 78% 48%"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="3"
                    className="animate-pulse"
                  />
                </>
              )}
            </svg>

            {/* Interactive Camera Nodes Markers */}
            {cameras.map((cam) => {
              const isSelected = selectedCamera?.id === cam.id;
              return (
                <div
                  key={cam.id}
                  onClick={() => setSelectedCamera(cam)}
                  className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 group z-10"
                  style={{ top: `${cam.lat}%`, left: `${cam.lng}%` }}
                >
                  {/* Ping Animation for Alerts */}
                  {cam.status === 'Alert' && (
                    <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-red-500 opacity-75 -left-2 -top-2"></span>
                  )}

                  <div
                    className={`camera-map-marker p-2 rounded-full border transition-all flex items-center justify-center ${
                      isSelected
                        ? 'bg-cyan-500 text-slate-950 border-white scale-125 shadow-lg shadow-cyan-500/50'
                        : cam.status === 'Alert'
                        ? 'bg-red-600 text-white border-red-400 animate-bounce'
                        : cam.status === 'Active'
                        ? 'bg-slate-900 text-emerald-400 border-emerald-500/60'
                        : 'bg-slate-900 text-slate-500 border-slate-700'
                    }`}
                  >
                    <Camera size={16} />
                  </div>

                  {/* Hover Tag */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap bg-slate-900/90 text-white text-[11px] px-2 py-1 rounded border border-slate-700 pointer-events-none z-20">
                    <span className="font-bold">{cam.name}</span>
                    <span className="block font-mono text-[10px] text-cyan-400">Node: {cam.id}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Map Legend Overlay */}
          <div className="relative z-20 bg-slate-900/90 backdrop-blur p-3 rounded-lg border border-slate-800 flex justify-between items-center text-xs text-slate-300">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Active Node
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse inline-block"></span> Alert Node (Hotlist Match)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block"></span> Maintenance
              </span>
            </div>

            <div className="font-mono text-cyan-400 text-[11px]">
              GRID RESOLUTION: 0.1 METER / ANPR RECON
            </div>
          </div>
        </div>

        {/* Selected Camera Node Detail Card */}
        <div className="card bg-slate-900 border-slate-800 p-5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="badge badge-cyan">{selectedCamera.id}</span>
                <h3 className="font-bold text-white text-base mt-1">{selectedCamera.name}</h3>
                <p className="text-xs text-slate-400">{selectedCamera.zone}</p>
              </div>

              <span
                className={`badge ${
                  selectedCamera.status === 'Alert'
                    ? 'badge-critical'
                    : selectedCamera.status === 'Active'
                    ? 'badge-emerald'
                    : 'badge-slate'
                }`}
              >
                {selectedCamera.status}
              </span>
            </div>

            <div className="space-y-3 border-t border-b border-slate-800 py-4 my-4 text-xs">
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">Sensor Hardware</span>
                <span className="font-mono text-white">{selectedCamera.resolution}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">FPS Capture Rate</span>
                <span className="font-mono text-emerald-400">{selectedCamera.fps} FPS</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">Scanned Today</span>
                <span className="font-mono text-cyan-400 font-bold">{selectedCamera.scannedToday} Vehicles</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">Latest Detection</span>
                <span className="font-mono text-amber-400 font-bold">{selectedCamera.lastPlate}</span>
              </div>
            </div>

            {/* Target Trajectory Box */}
            {showHotlistTrail && criticalHotlistItem && (
              <div className="p-3 bg-red-950/40 border border-red-500/50 rounded-lg text-xs text-red-300">
                <div className="font-bold text-red-400 flex items-center gap-1.5 mb-1">
                  <AlertTriangle size={14} /> ACTIVE TRACKING: {criticalHotlistItem.plateNumber}
                </div>
                <div className="text-[11px] text-slate-300">
                  Target heading towards {selectedCamera.zone}. Sector patrol units alerted.
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800">
            <button
              onClick={() =>
                onOpenDispatch({
                  id: `MAP-ALERT-${selectedCamera.id}`,
                  plateNumber: selectedCamera.lastPlate,
                  cameraName: selectedCamera.name,
                  vehicleDetails: 'High Priority Node Alert',
                  timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16)
                })
              }
              className="btn btn-danger w-full flex items-center justify-center gap-2"
            >
              <Radio size={16} /> Dispatch Patrol to Node {selectedCamera.id}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
