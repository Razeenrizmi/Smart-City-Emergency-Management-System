import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Camera,
  FileText,
  Map,
  BarChart3,
  Radio,
  Bell,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertOctagon,
  Shield,
  Siren
} from 'lucide-react';
import LiveANPRMonitor from './components/LiveANPRMonitor';
import HotlistManager from './components/HotlistManager';
import DetectionLogs from './components/DetectionLogs';
import CameraNetworkMap from './components/CameraNetworkMap';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import DispatchModal from './components/DispatchModal';
import { crimeVehicleService } from './services/crimeVehicleService';

export default function CrimeVehiclePage() {
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'hotlist' | 'logs' | 'map' | 'analytics'
  const [loading, setLoading] = useState(true);

  // Core datasets
  const [cameras, setCameras] = useState([]);
  const [hotlist, setHotlist] = useState([]);
  const [logs, setLogs] = useState([]);
  const [patrolUnits, setPatrolUnits] = useState([]);

  // Dispatch modal state
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [selectedDetectionForDispatch, setSelectedDetectionForDispatch] = useState(null);

  // Fetch initial data
  const loadData = async () => {
    setLoading(true);
    const [cams, hlist, logData, patrols] = await Promise.all([
      crimeVehicleService.getCameras(),
      crimeVehicleService.getHotlist(),
      crimeVehicleService.getDetectionLogs(),
      crimeVehicleService.getPatrolUnits()
    ]);
    setCameras(cams);
    setHotlist(hlist);
    setLogs(logData);
    setPatrolUnits(patrols);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handlers for state updates
  const handleAddHotlist = async (newVehicle) => {
    await crimeVehicleService.addHotlistVehicle(newVehicle);
    const updated = await crimeVehicleService.getHotlist();
    setHotlist(updated);
  };

  const handleUpdateStatus = async (id, status) => {
    const updated = await crimeVehicleService.updateHotlistStatus(id, status);
    setHotlist(updated);
  };

  const handleAnalyzeImage = async (imageUrl, plateNumber) => {
    const scanResult = await crimeVehicleService.analyzeVehicleImage(imageUrl, plateNumber);
    // Refresh logs if match created new log
    const updatedLogs = await crimeVehicleService.getDetectionLogs();
    setLogs(updatedLogs);
    return scanResult;
  };

  const handleOpenDispatch = (detectionLog) => {
    setSelectedDetectionForDispatch(detectionLog);
    setDispatchModalOpen(true);
  };

  const handleConfirmDispatch = async (unitId, logId) => {
    await crimeVehicleService.dispatchPatrol(unitId, logId);
    const [updatedLogs, updatedPatrols] = await Promise.all([
      crimeVehicleService.getDetectionLogs(),
      crimeVehicleService.getPatrolUnits()
    ]);
    setLogs(updatedLogs);
    setPatrolUnits(updatedPatrols);
  };

  // Critical alerts for live ticker
  const criticalAlerts = hotlist.filter(h => h.threatLevel === 'CRITICAL' && h.status === 'WANTED');

  return (
    <div className="crime-vehicle-root min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Top Header Command Bar */}
      <header className="command-header border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40 px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600/20 text-red-500 rounded-xl border border-red-500/40">
              <Siren size={28} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-white">SMART CITY EMERGENCY MANAGEMENT</h1>
                <span className="badge badge-critical text-[10px]">CRIME VEHICLE DETECTOR v3.0</span>
              </div>
              <p className="text-xs text-slate-400">
                Automated Number Plate Recognition (ANPR) & Intercept Command Console
              </p>
            </div>
          </div>

          {/* Header Quick Stats */}
          <div className="flex items-center gap-6 text-xs">
            <div className="hidden md:block">
              <span className="text-slate-400 block">Surveillance Nodes</span>
              <span className="font-mono text-cyan-400 font-bold">{cameras.length} ONLINE</span>
            </div>
            <div className="hidden md:block">
              <span className="text-slate-400 block">Wanted Hotlist</span>
              <span className="font-mono text-red-400 font-bold">{hotlist.length} TARGETS</span>
            </div>
            <button onClick={loadData} className="btn-icon" title="Refresh Live Data">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      {/* Critical Alert Ticker Banner */}
      {criticalAlerts.length > 0 && (
        <div className="bg-red-950/80 border-b border-red-600/60 px-6 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 text-xs font-mono text-red-200">
            <div className="flex items-center gap-2 truncate">
              <AlertOctagon className="text-red-500 animate-bounce shrink-0" size={16} />
              <span className="font-bold text-red-400">CRITICAL HOTLIST ALERT:</span>
              <span className="truncate">
                TARGET PLATE <strong>{criticalAlerts[0].plateNumber}</strong> ({criticalAlerts[0].makeModel}) — {criticalAlerts[0].incidentType}
              </span>
            </div>
            <button
              onClick={() => handleOpenDispatch({
                id: criticalAlerts[0].id,
                plateNumber: criticalAlerts[0].plateNumber,
                cameraName: criticalAlerts[0].lastSeenCamera,
                vehicleDetails: criticalAlerts[0].makeModel,
                timestamp: criticalAlerts[0].wantedSince
              })}
              className="btn btn-danger btn-xs shrink-0 font-sans text-[11px]"
            >
              Dispatch Patrol Unit
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Navigation Tabs */}
        <div className="nav-tabs flex flex-wrap gap-2 mb-6 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('live')}
            className={`nav-tab-btn ${activeTab === 'live' ? 'active' : ''}`}
          >
            <Camera size={18} /> Live ANPR Monitor
          </button>
          <button
            onClick={() => setActiveTab('hotlist')}
            className={`nav-tab-btn ${activeTab === 'hotlist' ? 'active' : ''}`}
          >
            <ShieldAlert size={18} /> Wanted Hotlist ({hotlist.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`nav-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          >
            <FileText size={18} /> Detection Audit Logs
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`nav-tab-btn ${activeTab === 'map' ? 'active' : ''}`}
          >
            <Map size={18} /> Camera Network Map
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`nav-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          >
            <BarChart3 size={18} /> Command Analytics
          </button>
        </div>

        {/* Tab Contents */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="animate-spin text-cyan-400 mb-3" size={36} />
            <span className="font-mono text-slate-400 text-sm">Connecting to Smart City ANPR Data Stream...</span>
          </div>
        ) : (
          <>
            {activeTab === 'live' && (
              <LiveANPRMonitor
                cameras={cameras}
                hotlist={hotlist}
                onOpenDispatch={handleOpenDispatch}
                onAnalyzeImage={handleAnalyzeImage}
              />
            )}

            {activeTab === 'hotlist' && (
              <HotlistManager
                hotlist={hotlist}
                onAddHotlist={handleAddHotlist}
                onUpdateStatus={handleUpdateStatus}
                onOpenDispatch={handleOpenDispatch}
              />
            )}

            {activeTab === 'logs' && (
              <DetectionLogs
                logs={logs}
                onOpenDispatch={handleOpenDispatch}
              />
            )}

            {activeTab === 'map' && (
              <CameraNetworkMap
                cameras={cameras}
                hotlist={hotlist}
                onOpenDispatch={handleOpenDispatch}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsDashboard
                stats={{ totalScannedToday: 18450 }}
                logs={logs}
                hotlist={hotlist}
                patrolUnits={patrolUnits}
              />
            )}
          </>
        )}
      </main>

      {/* Emergency Patrol Dispatch Modal */}
      <DispatchModal
        isOpen={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        detectionLog={selectedDetectionForDispatch}
        patrolUnits={patrolUnits}
        onDispatch={handleConfirmDispatch}
      />
    </div>
  );
}
