import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Scan,
  AlertTriangle,
  Zap,
  CheckCircle,
  ShieldAlert,
  Eye,
  Maximize2,
  RefreshCw,
  Layers,
  Video,
  VideoOff,
  Circle
} from 'lucide-react';
import { SAMPLE_SCAN_PRESETS } from '../data/mockCrimeVehicleData';
import apiClient from '../../../services/appClient';

export default function LiveANPRMonitor({ cameras, hotlist, onOpenDispatch, onAnalyzeImage }) {
  const [activeCameraId, setActiveCameraId] = useState(cameras[0]?.id || 'CAM-101');
  const [activeTab, setActiveTab] = useState('live');

  // Webcam state
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamScanning, setWebcamScanning] = useState(false);
  const [webcamResult, setWebcamResult] = useState(null);
  const [webcamError, setWebcamError] = useState(null);
  const [countdown, setCountdown] = useState(null);

  // ANPR Scanner state
  const [selectedPreset, setSelectedPreset] = useState(SAMPLE_SCAN_PRESETS[0]);
  const [customPlateInput, setCustomPlateInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const [scannerY, setScannerY] = useState(15);
  useEffect(() => {
    const interval = setInterval(() => {
      setScannerY((prev) => (prev >= 85 ? 15 : prev + 7));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const activeCamera = cameras.find((c) => c.id === activeCameraId) || cameras[0];

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Attach stream to video element when webcam becomes active
  useEffect(() => {
    if (webcamActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [webcamActive]);

  const toggleWebcam = useCallback(async () => {
    if (webcamActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setWebcamActive(false);
      setWebcamResult(null);
      setCountdown(null);
      setWebcamScanning(false);
      setWebcamError(null);
    } else {
      try {
        setWebcamError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' }
        });
        streamRef.current = stream;
        setWebcamActive(true);
        setWebcamResult(null);
      } catch (err) {
        setWebcamError('Camera access denied. Please allow camera permissions.');
      }
    }
  }, [webcamActive]);

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.9);
  };

  const runWebcamScan = async () => {
    if (webcamScanning || !webcamActive) return;
    setWebcamScanning(true);
    setWebcamResult(null);
    try {
      const imageData = captureFrame();
      if (!imageData) { setWebcamScanning(false); return; }
      const response = await fetch(imageData);
      const blob = await response.blob();
      const formData = new FormData();
      formData.append('image', blob, 'webcam-capture.jpg');
      const apiResponse = await apiClient.post('/crime-vehicle/scan', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (apiResponse.data?.success && apiResponse.data?.data) {
        setWebcamResult(apiResponse.data.data);
      }
    } catch (err) {
      setWebcamError('Failed to connect to backend.');
    } finally {
      setWebcamScanning(false);
    }
  };

  const handleWebcamScanWithCountdown = () => {
    if (webcamScanning || !webcamActive) return;
    setWebcamResult(null);
    setCountdown(3);
    let count = 3;
    const timer = setInterval(() => {
      count--;
      if (count <= 0) { clearInterval(timer); setCountdown(null); runWebcamScan(); }
      else { setCountdown(count); }
    }, 1000);
  };

  const handleRunScan = async (preset = selectedPreset) => {
    setScanning(true);
    setScanResult(null);
    const result = await onAnalyzeImage(preset.image, customPlateInput || preset.detectedPlate);
    setScanResult(result);
    setScanning(false);
  };

  return (
    <div className="anpr-monitor-container">
      <div className="section-header flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Camera className="text-cyan-400" size={24} />
            AUTOMATIC NUMBER PLATE RECOGNITION (ANPR) SURVEILLANCE
          </h2>
          <p className="text-xs text-slate-400">
            Real-time multi-lane OCR video feeds & tactical image scanner system
          </p>
        </div>
        <div className="tab-pill-group">
          <button onClick={() => setActiveTab('live')} className={`tab-pill ${activeTab === 'live' ? 'active' : ''}`}>
            <Eye size={16} /> Live CCTV Feeds
          </button>
          <button onClick={() => setActiveTab('scanner')} className={`tab-pill ${activeTab === 'scanner' ? 'active' : ''}`}>
            <Scan size={16} /> ANPR Image Scanner
          </button>
        </div>
      </div>

      {activeTab === 'live' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card bg-slate-900 border-slate-800 p-4">
            {/* Header */}
            <div className="feed-viewport-header flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{activeCamera?.name}</h3>
                  <span className="text-xs text-cyan-400">{activeCamera?.zone} &bull; Node ID: {activeCamera?.id}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="badge badge-cyan">{activeCamera?.resolution}</span>
                <span className="badge badge-emerald">{activeCamera?.fps} FPS</span>
                <button className="btn-icon" title="Fullscreen">
                  <Maximize2 size={16} />
                </button>
              </div>
            </div>

            {/* Video Canvas - webcam replaces CCTV directly */}
            <div className="feed-canvas relative mt-3 rounded-lg overflow-hidden bg-black aspect-video border border-slate-800">
              {/* Static CCTV Image */}
              {!webcamActive && (
                <img
                  src="https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1200&q=80"
                  alt="Live Traffic Feed"
                  className="w-full h-full object-cover filter brightness-90"
                />
              )}

              {/* Live Webcam Video */}
              {webcamActive && (
                <>
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                </>
              )}

              {/* Webcam toggle button - top right corner of feed */}
              <button
                onClick={toggleWebcam}
                className={`absolute top-3 right-3 z-20 p-2 rounded-lg backdrop-blur border transition-all pointer-events-auto ${
                  webcamActive
                    ? 'bg-red-600/80 border-red-500 text-white hover:bg-red-600'
                    : 'bg-black/60 border-slate-600 text-slate-300 hover:bg-black/80 hover:text-white'
                }`}
                title={webcamActive ? 'Switch to CCTV' : 'Switch to Webcam'}
              >
                {webcamActive ? <VideoOff size={18} /> : <Video size={18} />}
              </button>

              {/* HUD Overlay - always visible */}
              <div className="absolute inset-0 pointer-events-none hud-overlay">
                {!webcamActive && (
                  <>
                    <div className="scanner-beam-line" style={{ top: `${scannerY}%` }}></div>
                    <div className="hud-corner top-left"></div>
                    <div className="hud-corner top-right"></div>
                    <div className="hud-corner bottom-left"></div>
                    <div className="hud-corner bottom-right"></div>
                    <div className="anpr-bounding-box" style={{ top: '42%', left: '34%', width: '32%', height: '28%' }}>
                      <div className="anpr-label flex items-center justify-between">
                        <span className="font-mono font-bold text-xs bg-red-600 text-white px-1.5 py-0.5 rounded">
                          MATCH: WP CAD-7829
                        </span>
                        <span className="text-[10px] text-red-300 bg-red-950/80 px-1 rounded">99.2% OCR</span>
                      </div>
                      <div className="bbox-target-icon"></div>
                    </div>
                  </>
                )}

                {/* Webcam scan frame corners */}
                {webcamActive && (
                  <>
                    <div className="absolute top-[15%] left-[15%] w-8 h-8 border-t-2 border-l-2 border-cyan-400 rounded-tl-lg"></div>
                    <div className="absolute top-[15%] right-[15%] w-8 h-8 border-t-2 border-r-2 border-cyan-400 rounded-tr-lg"></div>
                    <div className="absolute bottom-[15%] left-[15%] w-8 h-8 border-b-2 border-l-2 border-cyan-400 rounded-bl-lg"></div>
                    <div className="absolute bottom-[15%] right-[15%] w-8 h-8 border-b-2 border-r-2 border-cyan-400 rounded-br-lg"></div>
                  </>
                )}

                {/* Webcam scan beam */}
                {webcamActive && webcamScanning && (
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-scan"></div>
                  </div>
                )}

                {/* Countdown */}
                {countdown !== null && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-8xl font-black text-cyan-400 animate-pulse">{countdown}</div>
                  </div>
                )}

                {/* Bottom-left info HUD */}
                <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur border border-slate-700/80 p-2 rounded text-[11px] font-mono text-cyan-300">
                  {webcamActive ? (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </div>
                        <span>LIVE WEBCAM FEED</span>
                      </div>
                      <div className="text-slate-400 mt-1">ANPR ENGINE v4.2 | WEBCLAW NODE</div>
                    </>
                  ) : (
                    <>
                      <div>LAT/LNG: 6.9271° N, 79.8612° E</div>
                      <div>ANPR ENGINE v4.2 | ACTIVE MATCH: 1 DETECTED</div>
                      <div>SPEED EST: 78 KM/H</div>
                    </>
                  )}
                </div>

                {/* Webcam result overlay */}
                {webcamActive && webcamResult && (
                  <div className={`absolute bottom-3 right-3 p-2 rounded-lg border backdrop-blur text-xs font-mono ${
                    webcamResult.isMatch
                      ? 'bg-red-900/90 border-red-500 text-red-200'
                      : 'bg-emerald-900/90 border-emerald-500 text-emerald-200'
                  }`}>
                    <div className="font-bold">{webcamResult.detectedPlate}</div>
                    <div className="text-[10px] opacity-80">{webcamResult.confidence}% confidence</div>
                  </div>
                )}

                {/* Webcam error */}
                {webcamError && (
                  <div className="absolute top-3 left-3 bg-red-900/90 border border-red-500 p-2 rounded text-xs text-red-200 z-10">
                    {webcamError}
                  </div>
                )}
              </div>
            </div>

            {/* Stats / Controls bar */}
            <div className="grid grid-cols-3 gap-3 mt-4 text-center">
              {webcamActive ? (
                <>
                  <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-800">
                    <div className="text-xs text-slate-400">Webcam Status</div>
                    <div className="text-lg font-bold text-cyan-400 flex items-center justify-center gap-1">
                      <Circle size={10} className="fill-cyan-400" /> ACTIVE
                    </div>
                  </div>
                  <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-800">
                    <div className="text-xs text-slate-400">Last Scan Result</div>
                    <div className="text-lg font-bold font-mono text-amber-400">
                      {webcamResult?.detectedPlate || '---'}
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={handleWebcamScanWithCountdown}
                      disabled={webcamScanning || countdown !== null}
                      className="btn btn-primary h-11 px-5 flex items-center gap-2"
                    >
                      {webcamScanning ? <><RefreshCw className="animate-spin" size={16} /> Scanning...</> : <><Zap size={16} /> Scan Plate</>}
                    </button>
                    <button onClick={toggleWebcam} className="btn btn-danger h-11 px-3 flex items-center gap-1" title="Stop Webcam">
                      <VideoOff size={16} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-800">
                    <div className="text-xs text-slate-400">Scanned Vehicles Today</div>
                    <div className="text-lg font-bold text-cyan-400">{activeCamera?.scannedToday}</div>
                  </div>
                  <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-800">
                    <div className="text-xs text-slate-400">Last Detected License Plate</div>
                    <div className="text-lg font-bold font-mono text-amber-400">{activeCamera?.lastPlate}</div>
                  </div>
                  <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-800">
                    <div className="text-xs text-slate-400">Camera Status</div>
                    <div className="text-lg font-bold text-emerald-400 flex items-center justify-center gap-1">
                      <CheckCircle size={16} /> ONLINE
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="card bg-slate-900 border-slate-800 p-4">
            {webcamActive ? (
              <>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <Video size={18} className="text-cyan-400" />
                    WEBCAM SCAN RESULTS
                  </h3>
                </div>
                {webcamResult ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                      <div className="text-xs text-slate-400 mb-1">Detected Plate</div>
                      <div className="font-mono text-xl font-bold text-amber-400">{webcamResult.detectedPlate}</div>
                    </div>
                    <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                      <div className="text-xs text-slate-400 mb-1">Confidence</div>
                      <div className="font-mono text-sm font-bold text-emerald-400">{webcamResult.confidence}%</div>
                    </div>
                    <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                      <div className="text-xs text-slate-400 mb-1">Vehicle</div>
                      <div className="text-sm text-slate-200">{webcamResult.vehicleInfo}</div>
                    </div>
                    <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                      <div className="text-xs text-slate-400 mb-1">Scanned At</div>
                      <div className="text-xs font-mono text-slate-300">{webcamResult.scannedAt}</div>
                    </div>
                    {webcamResult.isMatch ? (
                      <div className="p-4 bg-red-950/60 border border-red-500/80 rounded-lg">
                        <div className="flex items-center gap-2 font-bold text-red-400 mb-2">
                          <ShieldAlert className="animate-pulse" size={18} /> HOTLIST MATCH!
                        </div>
                        <div className="space-y-1 text-xs text-red-300">
                          <p><strong>Plate:</strong> {webcamResult.matchedVehicle?.plateNumber}</p>
                          <p><strong>Vehicle:</strong> {webcamResult.matchedVehicle?.makeModel}</p>
                          <p><strong>Threat:</strong> {webcamResult.matchedVehicle?.threatLevel}</p>
                          <p><strong>Incident:</strong> {webcamResult.matchedVehicle?.incidentType}</p>
                        </div>
                        <button
                          onClick={() => onOpenDispatch({
                            id: `WEBCAM-${Date.now()}`,
                            plateNumber: webcamResult.detectedPlate,
                            cameraName: 'Laptop Webcam ANPR',
                            vehicleDetails: webcamResult.vehicleInfo,
                            timestamp: webcamResult.scannedAt
                          })}
                          className="btn btn-danger w-full mt-3 flex items-center justify-center gap-2"
                        >
                          <AlertTriangle size={16} /> Dispatch Patrol Unit
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 bg-emerald-950/40 border border-emerald-500/50 rounded-lg text-emerald-300">
                        <div className="flex items-center gap-2 font-bold text-emerald-400">
                          <CheckCircle size={18} /> NO MATCH
                        </div>
                        <p className="text-xs text-slate-300 mt-1">Vehicle cleared. Not in hotlist database.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    <Camera size={36} className="mx-auto mb-3 opacity-40" />
                    <p>Click <strong>"Scan Plate"</strong> to analyze the webcam feed.</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <Layers size={18} className="text-cyan-400" />
                    SURVEILLANCE NODE GRID
                  </h3>
                  <span className="badge badge-slate">{cameras.length} NODES</span>
                </div>
                <div className="camera-grid grid gap-3 max-h-[480px] overflow-y-auto pr-1">
                  {cameras.map((cam) => (
                    <div
                      key={cam.id}
                      onClick={() => setActiveCameraId(cam.id)}
                      className={`camera-node-card cursor-pointer p-3 rounded-lg border transition-all ${
                        activeCameraId === cam.id
                          ? 'bg-cyan-950/40 border-cyan-500 shadow-lg shadow-cyan-950'
                          : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-slate-200 text-sm">{cam.name}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{cam.zone} &bull; {cam.id}</div>
                        </div>
                        <span className={`badge ${cam.status === 'Alert' ? 'badge-critical' : cam.status === 'Active' ? 'badge-emerald' : 'badge-slate'}`}>
                          {cam.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-800/80 text-xs">
                        <span className="text-slate-400">Last scan: <strong className="text-white font-mono">{cam.lastPlate}</strong></span>
                        <span className="text-cyan-400 text-[11px]">{cam.lastScanTime}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'scanner' && (
        <div className="card bg-slate-900 border-slate-800 p-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                <Zap className="text-amber-400 animate-pulse" size={24} />
                TACTICAL ANPR IMAGE SCANNER & MATCH ENGINE
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Upload or select sample vehicle images to run character extraction, color identification, and hotlist verification.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {SAMPLE_SCAN_PRESETS.map((preset, idx) => (
                <div
                  key={idx}
                  onClick={() => { setSelectedPreset(preset); setCustomPlateInput(''); setScanResult(null); }}
                  className={`preset-select-card cursor-pointer p-3 rounded-lg border relative overflow-hidden transition-all ${
                    selectedPreset.image === preset.image
                      ? 'border-cyan-400 bg-cyan-950/30'
                      : 'border-slate-800 bg-slate-800/40 hover:border-slate-700'
                  }`}
                >
                  <img src={preset.image} alt={preset.name} className="w-full h-28 object-cover rounded mb-2" />
                  <div className="text-xs font-bold text-white truncate">{preset.name}</div>
                  <div className="text-[11px] font-mono text-cyan-300 mt-0.5">Target Plate: {preset.detectedPlate}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 items-center justify-between bg-slate-800/60 p-4 rounded-xl border border-slate-700 mb-6">
              <div className="flex-1 min-w-[260px]">
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Override / Test License Plate OCR String (Optional)</label>
                <input
                  type="text"
                  placeholder={`e.g. ${selectedPreset.detectedPlate}`}
                  value={customPlateInput}
                  onChange={(e) => setCustomPlateInput(e.target.value.toUpperCase())}
                  className="input font-mono uppercase"
                />
              </div>
              <button
                type="button"
                onClick={() => handleRunScan()}
                disabled={scanning}
                className="btn btn-primary h-11 px-6 flex items-center gap-2 mt-4 sm:mt-0"
              >
                {scanning ? <RefreshCw className="animate-spin" size={18} /> : <Zap size={18} />}
                {scanning ? 'Running AI ANPR OCR...' : 'Run ANPR Optical Scan'}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative rounded-xl overflow-hidden bg-black border border-slate-800 min-h-[300px] flex items-center justify-center">
                <img
                  src={selectedPreset.image}
                  alt="Vehicle Scan Target"
                  className={`w-full h-full object-cover transition-filter ${scanning ? 'brightness-50 filter blur-[1px]' : ''}`}
                />
                {scanning && (
                  <div className="absolute inset-0 bg-cyan-950/40 flex flex-col items-center justify-center">
                    <RefreshCw className="animate-spin text-cyan-400 mb-2" size={40} />
                    <span className="font-mono text-cyan-300 font-bold text-sm">Extracting License Plate OCR...</span>
                  </div>
                )}
                {!scanning && (scanResult || selectedPreset) && (
                  <div className={`anpr-bounding-box ${scanResult?.isMatch ? 'match-critical' : 'match-clear'}`} style={scanResult?.box || selectedPreset.box}>
                    <div className="anpr-label font-mono font-bold text-xs bg-black/90 text-cyan-300 border border-cyan-500/60 p-1 rounded">
                      OCR: {scanResult?.detectedPlate || selectedPreset.detectedPlate} ({scanResult?.confidence || selectedPreset.confidence}%)
                    </div>
                  </div>
                )}
              </div>
              <div className="card bg-slate-800/40 border-slate-700/80 p-5 flex flex-col justify-between">
                <div>
                  <h4 className="text-base font-bold text-white flex items-center gap-2 mb-3">
                    <Scan className="text-cyan-400" size={18} />
                    ANPR OCR EXTRACTION REPORT
                  </h4>
                  {scanResult ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-slate-900/80 rounded-lg border border-slate-700">
                        <span className="text-xs text-slate-400">Extracted Plate OCR</span>
                        <span className="font-mono text-lg font-bold text-amber-400">{scanResult.detectedPlate}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-900/80 rounded-lg border border-slate-700 text-xs">
                        <span className="text-slate-400">OCR Confidence Score</span>
                        <span className="font-mono text-emerald-400 font-bold">{scanResult.confidence}% High Precision</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-900/80 rounded-lg border border-slate-700 text-xs">
                        <span className="text-slate-400">Identified Vehicle Class</span>
                        <span className="text-slate-200 font-medium">{scanResult.vehicleInfo}</span>
                      </div>
                      {scanResult.isMatch ? (
                        <div className="p-4 bg-red-950/60 border border-red-500/80 rounded-lg text-red-200">
                          <div className="flex items-center gap-2 font-bold text-red-400 mb-1">
                            <ShieldAlert className="animate-pulse" size={20} /> CRIME HOTLIST MATCH DETECTED!
                          </div>
                          <p className="text-xs text-red-300"><strong>Incident:</strong> {scanResult.matchedVehicle?.incidentType}</p>
                          <p className="text-xs text-red-300 mt-1"><strong>Threat Level:</strong> {scanResult.matchedVehicle?.threatLevel}</p>
                        </div>
                      ) : (
                        <div className="p-4 bg-emerald-950/40 border border-emerald-500/50 rounded-lg text-emerald-300">
                          <div className="flex items-center gap-2 font-bold text-emerald-400 mb-1">
                            <CheckCircle size={18} /> NO HOTLIST MATCH
                          </div>
                          <p className="text-xs text-slate-300">Vehicle plate cleared. Not registered in city criminal database.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      Click <strong>"Run ANPR Optical Scan"</strong> above to extract character sequences and run automated criminal hotlist check.
                    </div>
                  )}
                </div>
                {scanResult?.isMatch && (
                  <button
                    type="button"
                    onClick={() => onOpenDispatch({
                      id: `SCAN-${Date.now()}`,
                      plateNumber: scanResult.detectedPlate,
                      cameraName: 'Tactical ANPR Scanner Node',
                      vehicleDetails: scanResult.vehicleInfo,
                      timestamp: scanResult.scannedAt
                    })}
                    className="btn btn-danger w-full mt-4 flex items-center justify-center gap-2"
                  >
                    <AlertTriangle size={18} /> Trigger Immediate Intercept Dispatch
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
