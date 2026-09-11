import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Camera,
  CameraOff,
  Scan,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  Zap,
  Circle
} from 'lucide-react';
import apiClient from '../../../services/appClient';

export default function WebcamScanner({ onOpenDispatch }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment'
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsActive(true);
    } catch (err) {
      setError('Camera access denied. Please allow camera permissions and try again.');
      console.error('Camera error:', err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsActive(false);
    setScanResult(null);
    setCountdown(null);
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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

  const scanWithCountdown = () => {
    if (scanning || !isActive) return;
    setScanResult(null);
    setCountdown(3);

    let count = 3;
    const timer = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(timer);
        setCountdown(null);
        runScan();
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  const runScan = async () => {
    if (scanning || !isActive) return;
    setScanning(true);
    setScanResult(null);

    try {
      const imageData = captureFrame();
      if (!imageData) {
        setError('Failed to capture frame from webcam');
        setScanning(false);
        return;
      }

      // Convert base64 to blob
      const response = await fetch(imageData);
      const blob = await response.blob();

      // Send to backend
      const formData = new FormData();
      formData.append('image', blob, 'webcam-capture.jpg');

      const apiResponse = await apiClient.post('/crime-vehicle/scan', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (apiResponse.data?.success && apiResponse.data?.data) {
        setScanResult(apiResponse.data.data);
      } else {
        setError('Scan failed. Backend may be unavailable.');
      }
    } catch (err) {
      console.error('Scan error:', err);
      setError('Failed to connect to backend. Make sure the API is running.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="card bg-slate-900 border-slate-800 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-white flex items-center justify-center gap-2">
            <Camera className="text-cyan-400" size={24} />
            LIVE WEBCAM ANPR SCANNER
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Use your laptop webcam to scan vehicle plates in real-time against the criminal hotlist database.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Webcam Feed */}
          <div className="lg:col-span-2">
            <div className="relative rounded-xl overflow-hidden bg-black border border-slate-800 aspect-video">
              {/* Video Element */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${!isActive ? 'hidden' : ''}`}
              />

              {/* Canvas for capture (hidden) */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Placeholder when camera is off */}
              {!isActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
                  <CameraOff size={64} className="text-slate-600 mb-4" />
                  <p className="text-slate-400 text-sm mb-4">Webcam is not active</p>
                  <button
                    onClick={startCamera}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <Camera size={18} /> Activate Webcam
                  </button>
                  {error && (
                    <p className="text-red-400 text-xs mt-3 max-w-xs text-center">{error}</p>
                  )}
                </div>
              )}

              {/* Scanner Overlay when active */}
              {isActive && (
                <div className="absolute inset-0 pointer-events-none">
                  {/* Scanning frame border */}
                  <div className="absolute inset-[15%] border-2 border-cyan-400/60 rounded-lg">
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-400 rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-cyan-400 rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-cyan-400 rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-400 rounded-br-lg" />
                  </div>

                  {/* Scanning beam */}
                  {scanning && (
                    <div className="absolute inset-[15%] overflow-hidden rounded-lg">
                      <div className="scan-beam-webcam absolute w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-scan" />
                    </div>
                  )}

                  {/* Countdown overlay */}
                  {countdown !== null && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="text-8xl font-black text-cyan-400 animate-pulse">{countdown}</div>
                    </div>
                  )}

                  {/* Status HUD */}
                  <div className="absolute top-3 left-3 bg-black/80 backdrop-blur border border-slate-700 p-2 rounded text-[11px] font-mono text-cyan-300">
                    <div className="flex items-center gap-2">
                      <div className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </div>
                      <span>LIVE WEBCAM FEED</span>
                    </div>
                    <div className="text-slate-400 mt-1">ANPR ENGINE v4.2 | WEBCLAW NODE</div>
                  </div>

                  {/* Scan result overlay on video */}
                  {scanResult && (
                    <div className={`absolute bottom-3 right-3 p-2 rounded-lg border backdrop-blur text-xs font-mono ${
                      scanResult.isMatch
                        ? 'bg-red-900/80 border-red-500 text-red-200'
                        : 'bg-emerald-900/80 border-emerald-500 text-emerald-200'
                    }`}>
                      <div className="font-bold">{scanResult.detectedPlate}</div>
                      <div className="text-[10px] opacity-80">{scanResult.confidence}% confidence</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Camera Controls */}
            <div className="flex items-center justify-center gap-4 mt-4">
              {!isActive ? (
                <button onClick={startCamera} className="btn btn-primary flex items-center gap-2">
                  <Camera size={18} /> Start Camera
                </button>
              ) : (
                <>
                  <button
                    onClick={scanWithCountdown}
                    disabled={scanning || countdown !== null}
                    className="btn btn-primary h-12 px-8 flex items-center gap-2"
                  >
                    {scanning ? (
                      <><RefreshCw className="animate-spin" size={18} /> Scanning...</>
                    ) : (
                      <><Zap size={18} /> Scan Plate Now</>
                    )}
                  </button>
                  <button onClick={stopCamera} className="btn btn-danger flex items-center gap-2">
                    <CameraOff size={18} /> Stop Camera
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Scan Results Panel */}
          <div className="card bg-slate-800/40 border-slate-700/80 p-5 flex flex-col">
            <h4 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <Scan className="text-cyan-400" size={18} />
              WEBCAM SCAN RESULTS
            </h4>

            {scanResult ? (
              <div className="space-y-3 flex-1">
                <div className="flex justify-between items-center p-3 bg-slate-900/80 rounded-lg border border-slate-700">
                  <span className="text-xs text-slate-400">Detected Plate</span>
                  <span className="font-mono text-lg font-bold text-amber-400">
                    {scanResult.detectedPlate}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-900/80 rounded-lg border border-slate-700 text-xs">
                  <span className="text-slate-400">Confidence</span>
                  <span className="font-mono text-emerald-400 font-bold">{scanResult.confidence}%</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-900/80 rounded-lg border border-slate-700 text-xs">
                  <span className="text-slate-400">Vehicle Info</span>
                  <span className="text-slate-200 font-medium text-right max-w-[200px]">{scanResult.vehicleInfo}</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-900/80 rounded-lg border border-slate-700 text-xs">
                  <span className="text-slate-400">Scanned At</span>
                  <span className="text-slate-300 font-mono">{scanResult.scannedAt}</span>
                </div>

                {scanResult.isMatch ? (
                  <div className="p-4 bg-red-950/60 border border-red-500/80 rounded-lg text-red-200">
                    <div className="flex items-center gap-2 font-bold text-red-400 mb-2">
                      <ShieldAlert className="animate-pulse" size={20} />
                      HOTLIST MATCH!
                    </div>
                    <div className="space-y-1 text-xs text-red-300">
                      <p><strong>Plate:</strong> {scanResult.matchedVehicle?.plateNumber}</p>
                      <p><strong>Vehicle:</strong> {scanResult.matchedVehicle?.makeModel}</p>
                      <p><strong>Threat:</strong> {scanResult.matchedVehicle?.threatLevel}</p>
                      <p><strong>Incident:</strong> {scanResult.matchedVehicle?.incidentType}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-950/40 border border-emerald-500/50 rounded-lg text-emerald-300">
                    <div className="flex items-center gap-2 font-bold text-emerald-400">
                      <CheckCircle size={18} /> NO MATCH
                    </div>
                    <p className="text-xs text-slate-300 mt-1">Vehicle cleared. Not in hotlist database.</p>
                  </div>
                )}

                {scanResult.isMatch && (
                  <button
                    onClick={() =>
                      onOpenDispatch({
                        id: `WEBCAM-${Date.now()}`,
                        plateNumber: scanResult.detectedPlate,
                        cameraName: 'Laptop Webcam ANPR Scanner',
                        vehicleDetails: scanResult.vehicleInfo,
                        timestamp: scanResult.scannedAt
                      })
                    }
                    className="btn btn-danger w-full flex items-center justify-center gap-2 mt-2"
                  >
                    <AlertTriangle size={18} /> Dispatch Patrol Unit
                  </button>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8 text-slate-400">
                <Camera size={40} className="mb-3 opacity-40" />
                <p className="text-sm">
                  {isActive
                    ? 'Click "Scan Plate Now" to analyze the current camera frame'
                    : 'Activate the webcam to start scanning plates'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
