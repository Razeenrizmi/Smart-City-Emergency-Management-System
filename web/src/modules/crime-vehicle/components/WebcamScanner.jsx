import { useRef, useState, useCallback, useEffect } from 'react';
import {
  Camera, CameraOff, AlertTriangle, Zap, CheckCircle, ShieldAlert,
  RefreshCw, Play, Pause, Circle, Loader2, XCircle, User, Scan
} from 'lucide-react';
import { crimeVehicleService } from '../services/crimeVehicleService';

export default function WebcamScanner({ onOpenDispatch }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const monitoringIntervalRef = useRef(null);
  const isAnalyzingRef = useRef(false);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [latestSnapshot, setLatestSnapshot] = useState(null);

  const stopCctvMonitoring = useCallback(() => {
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
    }
    setIsMonitoring(false);
  }, []);

  const stopCamera = useCallback(() => {
    stopCctvMonitoring();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraActive(false);
  }, [stopCctvMonitoring]);

  useEffect(() => {
    return () => {
      if (monitoringIntervalRef.current) clearInterval(monitoringIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => { t.onended = null; t.stop(); });
      }
    };
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Webcam access is not supported by your browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' }
      });
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => { stopCamera(); setCameraError('Camera stream disconnected unexpectedly.'); };
      }
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
      setIsCameraActive(true);
    } catch (err) {
      console.error('Camera access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
        setCameraError('Camera permission denied. Please allow camera permissions in your browser settings.');
      else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')
        setCameraError('No video camera detected on your device.');
      else if (err.name === 'NotReadableError' || err.name === 'TrackStartError')
        setCameraError('Camera is currently in use by another application.');
      else setCameraError(`Camera error: ${err.message || 'Unable to access webcam.'}`);
      setIsCameraActive(false);
    }
  }, [stopCamera]);

  const captureFrameBlob = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({ blob, dataUrl });
      }, 'image/jpeg', 0.85);
    });
  }, []);

  const handleCaptureFrame = useCallback(async () => {
    if (!isCameraActive || isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;
    setIsAnalyzing(true);
    setCameraError(null);
    try {
      const frameData = await captureFrameBlob();
      if (!frameData || !frameData.blob) {
        setCameraError('Failed to capture frame from webcam.');
        return;
      }
      setLatestSnapshot(frameData.dataUrl);
      const result = await crimeVehicleService.scanFrame(frameData.blob);
      setScanResult(result);
    } catch (err) {
      console.error('Scan error:', err);
      setCameraError('Failed to process frame with AI detection service.');
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  }, [isCameraActive, captureFrameBlob]);

  const startCctvMonitoring = useCallback(() => {
    if (!isCameraActive) return;
    setIsMonitoring(true);
    handleCaptureFrame();
    if (monitoringIntervalRef.current) clearInterval(monitoringIntervalRef.current);
    monitoringIntervalRef.current = setInterval(() => {
      if (!isAnalyzingRef.current) handleCaptureFrame();
    }, 1000);
  }, [isCameraActive, handleCaptureFrame]);

  const status = scanResult?.detectionStatus || 'IDLE';

  const getStatusColor = () => {
    switch (status) {
      case 'NO_CRIME_MATCH': return 'text-emerald-400';
      case 'POSSIBLE_CRIME_MATCH': return 'text-red-400';
      case 'NO_VEHICLE': case 'PERSON_DETECTED': return 'text-slate-400';
      case 'VEHICLE_DETECTED_NO_PLATE': case 'PLATE_UNREADABLE': return 'text-amber-400';
      case 'AI_SERVICE_UNAVAILABLE': case 'ERROR': return 'text-red-400';
      default: return 'text-slate-500';
    }
  };

  const renderResultMessage = () => {
    if (!scanResult) return null;
    switch (status) {
      case 'NO_VEHICLE':
        return (
          <div className="p-4 bg-slate-100 border border-slate-200 rounded-lg text-slate-700">
            <div className="flex items-center gap-2 font-bold text-xs"><Circle size={16} /> No vehicle detected</div>
            <p className="text-[11px] text-slate-500 mt-1">{scanResult.vehicleInfo || 'No vehicle detected in current frame.'}</p>
          </div>
        );
      case 'PERSON_DETECTED':
        return (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-600">
            <div className="flex items-center gap-2 font-bold text-xs"><User size={16} /> Person detected. No vehicle detected.</div>
            <p className="text-[11px] text-slate-500 mt-1">{scanResult.vehicleInfo || 'A person was detected but no vehicle was found.'}</p>
          </div>
        );
      case 'VEHICLE_DETECTED_NO_PLATE':
        return (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-600">
            <div className="flex items-center gap-2 font-bold text-xs"><AlertTriangle size={16} /> Vehicle detected, but no readable license plate was found.</div>
            <p className="text-[11px] text-slate-500 mt-1">{scanResult.vehicleInfo}</p>
          </div>
        );
      case 'PLATE_UNREADABLE':
        return (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-600">
            <div className="flex items-center gap-2 font-bold text-xs"><AlertTriangle size={16} /> License plate detected but could not be read reliably.</div>
            <p className="text-[11px] text-slate-500 mt-1">{scanResult.vehicleInfo}</p>
          </div>
        );
      case 'AI_SERVICE_UNAVAILABLE':
      case 'ERROR':
        return (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            <div className="flex items-center gap-2 font-bold text-xs"><XCircle size={16} /> AI detection service unavailable</div>
            <p className="text-[11px] text-slate-500 mt-1">{scanResult.vehicleInfo}</p>
          </div>
        );
      case 'NO_CRIME_MATCH':
        return (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-600">
            <div className="flex items-center gap-2 font-bold text-xs"><CheckCircle size={16} /> Vehicle cleared</div>
            <p className="text-[11px] text-slate-700 mt-1">Plate {scanResult.detectedPlate} cleared. No crime database record found.</p>
          </div>
        );
      case 'POSSIBLE_CRIME_MATCH':
        return (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <div className="flex items-center gap-2 font-bold text-red-600 mb-2">
              <ShieldAlert className="animate-pulse" size={20} /> POSSIBLE CRIME-RELATED VEHICLE
            </div>
            <div className="space-y-1 text-xs text-red-600">
              <p><strong>Plate:</strong> {scanResult.matchedVehicle?.plateNumber || scanResult.detectedPlate}</p>
              <p><strong>Vehicle:</strong> {scanResult.matchedVehicle?.makeModel || scanResult.vehicleInfo}</p>
              <p><strong>Threat:</strong> {scanResult.matchedVehicle?.threatLevel || 'HIGH'}</p>
              <p><strong>Incident:</strong> {scanResult.matchedVehicle?.incidentType}</p>
            </div>
            {onOpenDispatch && (
              <button
                onClick={() => onOpenDispatch({
                  id: `WEBCAM-${Date.now()}`,
                  plateNumber: scanResult.detectedPlate,
                  cameraName: 'Laptop Webcam ANPR Scanner',
                  vehicleDetails: scanResult.vehicleInfo,
                  timestamp: scanResult.scannedAt
                })}
                className="btn bg-red-600 hover:bg-red-500 text-white w-full mt-3 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg"
              >
                <AlertTriangle size={16} /> Dispatch Patrol Unit
              </button>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="card bg-white border-slate-200 p-6 rounded-xl">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-slate-900 flex items-center justify-center gap-2">
            <Camera className="text-cyan-600" size={24} />
            LIVE WEBCAM ANPR SCANNER
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Use your webcam as a CCTV camera. Frames are analyzed by YOLO vehicle detection + EasyOCR plate reading.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col justify-between">
            <div>
              <div className="relative rounded-xl overflow-hidden bg-black border border-slate-200 aspect-video flex items-center justify-center">
                <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${!isCameraActive ? 'hidden' : ''}`} />
                <canvas ref={canvasRef} className="hidden" />

                {!isCameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-center p-6">
                    <div className="p-4 bg-slate-900 rounded-full border border-slate-800 mb-3">
                      <CameraOff size={48} className="text-slate-500" />
                    </div>
                    <h4 className="text-lg font-bold text-white mb-1">Webcam is Offline</h4>
                    <p className="text-xs text-slate-400 max-w-xs mb-4">Click "Start Camera" to activate your webcam as a CCTV camera.</p>
                    <button onClick={startCamera} className="btn bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 shadow-lg transition-all text-xs">
                      <Camera size={18} /> Start Camera
                    </button>
                    {cameraError && (
                      <div className="mt-4 p-3 bg-red-950/80 border border-red-500/80 rounded-lg text-red-200 text-xs max-w-sm flex items-start gap-2 text-left">
                        <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                        <span>{cameraError}</span>
                      </div>
                    )}
                  </div>
                )}

                {isCameraActive && (
                  <div className="absolute inset-0 pointer-events-none hud-overlay">
                    <div className="absolute top-3 left-3 bg-black/80 backdrop-blur border border-slate-700/80 p-2 rounded text-[11px] font-mono text-cyan-300">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span>CCTV ONLINE</span>
                      </div>
                      <div className="text-slate-400 mt-0.5">{isMonitoring ? 'MONITORING ACTIVE (1 FPS)' : 'STREAM ACTIVE'}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-center gap-2.5">
              <button onClick={startCamera} disabled={isCameraActive}
                className={`btn text-xs px-3.5 py-2 rounded-lg font-medium flex items-center gap-1.5 transition-all ${isCameraActive ? 'bg-slate-100 text-slate-500 cursor-not-allowed border border-slate-200' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'}`}>
                <Camera size={15} /> Start Camera
              </button>
              <button onClick={stopCamera} disabled={!isCameraActive}
                className={`btn text-xs px-3.5 py-2 rounded-lg font-medium flex items-center gap-1.5 transition-all ${!isCameraActive ? 'bg-slate-100 text-slate-500 cursor-not-allowed border border-slate-200' : 'bg-red-600/80 hover:bg-red-600 text-white border border-red-200'}`}>
                <CameraOff size={15} /> Stop Camera
              </button>
              <button onClick={handleCaptureFrame} disabled={!isCameraActive || isAnalyzing}
                className={`btn text-xs px-3.5 py-2 rounded-lg font-medium flex items-center gap-1.5 transition-all ${!isCameraActive || isAnalyzing ? 'bg-slate-100 text-slate-500 cursor-not-allowed border border-slate-200' : 'bg-amber-600 hover:bg-amber-500 text-white shadow-md'}`}>
                {isAnalyzing ? <RefreshCw size={15} className="animate-spin" /> : <Zap size={15} />}
                Capture Frame
              </button>
              <button onClick={startCctvMonitoring} disabled={!isCameraActive || isMonitoring}
                className={`btn text-xs px-3.5 py-2 rounded-lg font-medium flex items-center gap-1.5 transition-all ${!isCameraActive || isMonitoring ? 'bg-slate-100 text-slate-500 cursor-not-allowed border border-slate-200' : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md'}`}>
                <Play size={15} /> Start CCTV Monitoring
              </button>
              <button onClick={stopCctvMonitoring} disabled={!isMonitoring}
                className={`btn text-xs px-3.5 py-2 rounded-lg font-medium flex items-center gap-1.5 transition-all ${!isMonitoring ? 'bg-slate-100 text-slate-500 cursor-not-allowed border border-slate-200' : 'bg-slate-200 hover:bg-slate-600 text-slate-900 border border-slate-600'}`}>
                <Pause size={15} /> Stop CCTV Monitoring
              </button>
            </div>
          </div>

          {/* Results Panel */}
          <div className="card bg-slate-100 border-slate-200 p-5 rounded-xl flex flex-col justify-between">
            <div>
              <h4 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
                <Scan className="text-cyan-600" size={18} />
                WEBCAM SCAN RESULTS
                {scanResult && (
                  <span className={`ml-auto text-[10px] font-mono font-bold px-2 py-0.5 rounded ${getStatusColor()}`}>
                    {status}
                  </span>
                )}
              </h4>

              {isAnalyzing ? (
                <div className="p-6 bg-white/80 rounded-xl border border-cyan-200 text-center py-10">
                  <Loader2 size={36} className="animate-spin text-cyan-600 mx-auto mb-3" />
                  <h5 className="font-bold text-slate-900 text-sm">Analyzing current frame...</h5>
                  <p className="text-xs text-slate-500 mt-1">Processing via YOLO + EasyOCR detection engine.</p>
                </div>
              ) : scanResult ? (
                <div className="space-y-3">
                  {latestSnapshot && (
                    <div className="rounded-lg overflow-hidden border border-slate-200 aspect-video bg-black mb-2 relative">
                      <img src={latestSnapshot} alt="Snapshot" className="w-full h-full object-cover" />
                      <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black/80 ${getStatusColor()}`}>
                        {status}
                      </div>
                    </div>
                  )}

                  {scanResult.detectedPlate && !['NO_VEHICLE_DETECTED', 'NO_PLATE_DETECTED', 'ERROR'].includes(scanResult.detectedPlate) && (
                    <div className="flex justify-between items-center p-3 bg-white/80 rounded-lg border border-slate-200">
                      <span className="text-xs text-slate-500">Detected Plate</span>
                      <span className="font-mono text-lg font-bold text-amber-600">{scanResult.detectedPlate}</span>
                    </div>
                  )}

                  {scanResult.plateConfidence > 0 && (
                    <div className="flex justify-between items-center p-3 bg-white/80 rounded-lg border border-slate-200 text-xs">
                      <span className="text-slate-500">OCR Confidence</span>
                      <span className="font-mono text-emerald-600 font-bold">{scanResult.plateConfidence}%</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center p-3 bg-white/80 rounded-lg border border-slate-200 text-xs">
                    <span className="text-slate-500">Vehicle Info</span>
                    <span className="text-slate-900 font-medium text-right max-w-[180px] truncate">{scanResult.vehicleInfo || 'No data'}</span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-white/80 rounded-lg border border-slate-200 text-xs">
                    <span className="text-slate-500">Scanned At</span>
                    <span className="text-slate-700 font-mono text-[11px]">{scanResult.scannedAt}</span>
                  </div>

                  {renderResultMessage()}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-8 text-slate-500">
                  <Camera size={40} className="mb-3 opacity-40 text-cyan-600" />
                  <p className="text-xs">
                    {isCameraActive
                      ? 'Click "Capture Frame" or "Start CCTV Monitoring" to analyze the video feed.'
                      : 'Activate the webcam to start scanning.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
