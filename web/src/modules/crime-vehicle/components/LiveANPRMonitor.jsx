import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  Scan,
  AlertTriangle,
  Zap,
  CheckCircle,
  ShieldAlert,
  Eye,
  RefreshCw,
  Play,
  Pause,
  Circle,
  Loader2,
  Check,
  UserCheck,
  UserX,
  Cpu,
  Database,
  FileCheck,
  XCircle,
  User
} from 'lucide-react';
import { crimeVehicleService } from '../services/crimeVehicleService';
import CCTVNodeGrid from './cctv/CCTVNodeGrid';
import MobileCameraConnection from './cctv/MobileCameraConnection';
import FPSMonitorPanel from './cctv/FPSMonitorPanel';
import { isWebcamNode, isPhoneNode, phoneStreamUrl } from '../models/cctvNode';

const STATUS_CONFIG = {
  IDLE: { color: 'text-slate-500', bg: 'bg-slate-800', label: 'IDLE' },
  ANALYZING: { color: 'text-cyan-400', bg: 'bg-cyan-950', label: 'ANALYZING' },
  NO_VEHICLE: { color: 'text-slate-400', bg: 'bg-slate-800', label: 'NO VEHICLE' },
  PERSON_DETECTED: { color: 'text-blue-400', bg: 'bg-blue-950', label: 'PERSON DETECTED' },
  VEHICLE_DETECTED_NO_PLATE: { color: 'text-amber-400', bg: 'bg-amber-950', label: 'NO PLATE' },
  PLATE_UNREADABLE: { color: 'text-amber-400', bg: 'bg-amber-950', label: 'PLATE UNREADABLE' },
  AWAITING_CONFIRMATION: { color: 'text-slate-400', bg: 'bg-slate-800', label: 'CONFIRMING' },
  NO_CRIME_MATCH: { color: 'text-emerald-400', bg: 'bg-emerald-950', label: 'CLEARED' },
  POSSIBLE_CRIME_MATCH: { color: 'text-red-400', bg: 'bg-red-950', label: 'CRIME MATCH' },
  COOLDOWN_SUPPRESSED: { color: 'text-amber-400', bg: 'bg-amber-950', label: 'COOLDOWN' },
  AI_SERVICE_UNAVAILABLE: { color: 'text-red-400', bg: 'bg-red-950', label: 'AI OFFLINE' },
  ERROR: { color: 'text-red-400', bg: 'bg-red-950', label: 'ERROR' },
};

const DEFAULT_STATS = {
  streamFps: null,
  aiFps: null,
  vehicles: 0,
  crimeVehicles: 0
};

const DEFAULT_RT = {
  isCameraActive: false,
  isMonitoring: false,
  isAnalyzing: false,
  cameraError: null,
  latestResult: null,
  latestSnapshot: null,
  sessionId: null,
  streamMode: null, // 'webrtc' (getUserMedia) | 'mjpeg' (<img> stream URL) | null
  trackingStats: { activeTracks: 0, processedTracks: 0 },
  stats: { ...DEFAULT_STATS },
  frameLog: []
};

export default function LiveANPRMonitor({
  nodes = [],
  activeNodeId,
  onSelectNode,
  onStartSession,
  onStopNode,
  onNodeStatus,
  onNodeRuntimeChange,
  hotlist,
  onOpenDispatch,
  onScanComplete,
  detectionConfig
}) {
  const [runtime, setRuntime] = useState({});
  const [actionLoading, setActionLoading] = useState(false);

  const cfg = detectionConfig || { targetAiFps: 5, frameIntervalMs: 200, confirmationFrames: 3, alertCooldownSeconds: 60 };
  const frameIntervalMs = cfg.frameIntervalMs || Math.round(1000 / (cfg.targetAiFps || 5));
  const targetAiFps = cfg.targetAiFps || 5;

  // Per-node element/state refs — camera, session and tracking state never mix between nodes.
  const videoRefs = useRef({});
  const phoneImgRefs = useRef({});
  const canvasRefs = useRef({});
  const streamRefs = useRef({});
  const sessionRefs = useRef({});
  const analyzingRefs = useRef({});
  const intervalRefs = useRef({});
  // Honest measured FPS: real completion timestamps per node (sliding window).
  const aiStampRefs = useRef({});
  const streamFrameRefs = useRef({});
  const rVFCHandles = useRef({});

  const [scannerY, setScannerY] = useState(15);
  useEffect(() => {
    const interval = setInterval(() => {
      setScannerY((prev) => (prev >= 85 ? 15 : prev + 7));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const activeNode = nodes.find((n) => n.nodeId === activeNodeId) || nodes[0] || null;
  const activeId = activeNode ? activeNode.nodeId : null;
  const rt = (activeId != null ? runtime[activeId] : null) || DEFAULT_RT;

  const emitRuntime = useCallback((nodeId, value) => {
    if (onNodeRuntimeChange) onNodeRuntimeChange(nodeId, value);
  }, [onNodeRuntimeChange]);

  const updateRt = useCallback((nodeId, patch) => {
    if (nodeId == null) return;
    setRuntime((prev) => {
      const current = prev[nodeId] || DEFAULT_RT;
      const nextValue = typeof patch === 'function' ? patch(current) : { ...current, ...patch };
      const next = { ...prev, [nodeId]: nextValue };
      emitRuntime(nodeId, nextValue);
      return next;
    });
  }, [emitRuntime]);

  const reportStatus = useCallback((nodeId, status) => {
    if (nodeId == null) return;
    onNodeStatus?.(nodeId, status);
  }, [onNodeStatus]);

  // --- Measured stream FPS via requestVideoFrameCallback (real presented frames) ---
  const stopStreamFpsMeter = useCallback((nodeId) => {
    const handle = rVFCHandles.current[nodeId];
    const video = videoRefs.current[nodeId];
    if (handle != null && video && typeof video.cancelVideoFrameCallback === 'function') {
      try { video.cancelVideoFrameCallback(handle); } catch { /* already stopped */ }
    }
    rVFCHandles.current[nodeId] = null;
    streamFrameRefs.current[nodeId] = null;
  }, []);

  const startStreamFpsMeter = useCallback((nodeId) => {
    const video = videoRefs.current[nodeId];
    if (!video || typeof video.requestVideoFrameCallback !== 'function') return;
    stopStreamFpsMeter(nodeId);

    const state = { frames: 0, lastAt: performance.now() };
    streamFrameRefs.current[nodeId] = state;

    const tick = () => {
      if (!streamRefs.current[nodeId] || streamFrameRefs.current[nodeId] !== state) return;
      state.frames += 1;
      const now = performance.now();
      const elapsed = now - state.lastAt;
      if (elapsed >= 1000) {
        // Honest: count of actually presented video frames in the last second.
        const fps = Math.round((state.frames * 1000 / elapsed) * 10) / 10;
        updateRt(nodeId, (cur) => ({
          ...cur,
          stats: { ...(cur.stats || DEFAULT_STATS), streamFps: fps }
        }));
        state.frames = 0;
        state.lastAt = now;
      }
      try {
        rVFCHandles.current[nodeId] = video.requestVideoFrameCallback(tick);
      } catch { /* element gone */ }
    };

    try {
      rVFCHandles.current[nodeId] = video.requestVideoFrameCallback(tick);
    } catch { /* unsupported */ }
  }, [updateRt, stopStreamFpsMeter]);

  // --- Measured AI FPS from real scan completion timestamps ---
  const recordAiCompletion = useCallback((nodeId, serverFrameStats, clientProcessingMs, status) => {
    const now = performance.now();
    const stamps = aiStampRefs.current[nodeId] || [];
    stamps.push(now);
    if (stamps.length > 30) stamps.shift();
    aiStampRefs.current[nodeId] = stamps;

    let clientAiFps = null;
    if (stamps.length >= 2) {
      const span = (stamps[stamps.length - 1] - stamps[0]) / 1000;
      if (span > 0) clientAiFps = Math.round(((stamps.length - 1) / span) * 100) / 100;
    }

    const fs = serverFrameStats || {};
    // Prefer server-measured AI FPS (from real completion timestamps); fall back to client-measured.
    const aiFps = fs.aiFps != null && fs.aiFps > 0 ? fs.aiFps : clientAiFps;
    const processingMs = fs.processingMs != null ? fs.processingMs : clientProcessingMs;

    const logEntry = {
      nodeId,
      timestamp: fs.timestamp || new Date().toISOString(),
      clientAt: new Date().toISOString(),
      frameNumber: fs.frameNumber ?? null,
      processingMs: processingMs != null ? Math.round(processingMs * 10) / 10 : null,
      detectionCount: fs.detectionCount ?? null,
      trackCount: fs.trackCount ?? null,
      aiFps,
      status: status || '—'
    };

    updateRt(nodeId, (cur) => {
      const prevStats = cur.stats || DEFAULT_STATS;
      const frameLog = [logEntry, ...(cur.frameLog || [])].slice(0, 100);
      return {
        ...cur,
        stats: {
          ...prevStats,
          aiFps,
          vehicles: fs.trackCount != null ? fs.trackCount : prevStats.vehicles
        },
        frameLog
      };
    });
  }, [updateRt]);

  const stopCctvMonitoring = useCallback((nodeId) => {
    if (nodeId == null) return;
    if (intervalRefs.current[nodeId]) {
      clearInterval(intervalRefs.current[nodeId]);
      intervalRefs.current[nodeId] = null;
    }
    updateRt(nodeId, (cur) => ({ ...cur, isMonitoring: false }));

    const sessionId = sessionRefs.current[nodeId];
    if (sessionId) {
      crimeVehicleService.endSession(sessionId);
      sessionRefs.current[nodeId] = null;
      updateRt(nodeId, (cur) => ({
        ...cur,
        sessionId: null,
        trackingStats: { activeTracks: 0, processedTracks: 0 },
        stats: { ...(cur.stats || DEFAULT_STATS), vehicles: 0 }
      }));
    }
  }, [updateRt]);

  const stopCamera = useCallback((nodeId) => {
    if (nodeId == null) return;
    stopCctvMonitoring(nodeId);
    stopStreamFpsMeter(nodeId);
    aiStampRefs.current[nodeId] = [];

    if (streamRefs.current[nodeId]) {
      streamRefs.current[nodeId].getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      streamRefs.current[nodeId] = null;
    }
    const video = videoRefs.current[nodeId];
    if (video) video.srcObject = null;

    updateRt(nodeId, { ...DEFAULT_RT });
    reportStatus(nodeId, 'OFFLINE');
    onStopNode?.(nodeId);
  }, [stopCctvMonitoring, stopStreamFpsMeter, updateRt, reportStatus, onStopNode]);

  // Unmount cleanup: release every node's stream and intervals.
  useEffect(() => {
    const refs = { intervalRefs, streamRefs, rVFCHandles };
    return () => {
      Object.values(refs.intervalRefs.current).forEach((id) => id && clearInterval(id));
      Object.values(refs.streamRefs.current).forEach((stream) => {
        if (stream) stream.getTracks().forEach((t) => { t.onended = null; t.stop(); });
      });
      Object.entries(sessionRefs.current).forEach(([nodeId, sessionId]) => {
        if (sessionId) crimeVehicleService.endSession(sessionId);
      });
    };
  }, []);

  const startCamera = useCallback(async (nodeId) => {
    const node = nodes.find((n) => n.nodeId === nodeId);
    if (!node || nodeId == null) return;

    updateRt(nodeId, { cameraError: null });

    // --- Phone camera node ---
    if (isPhoneNode(node)) {
      const url = phoneStreamUrl(node);

      // METHOD A: MJPEG stream URL (optionally via the Vite /phonecam proxy)
      if (url) {
        updateRt(nodeId, { isCameraActive: true, streamMode: 'mjpeg', cameraError: null });
        reportStatus(nodeId, 'ONLINE');
        return;
      }

      // METHOD B: virtual webcam bridge (iVCam / Camo / etc.) created on this PC
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          updateRt(nodeId, { isCameraActive: false, cameraError: 'Camera access is not supported by your browser.' });
          return;
        }

        // Device labels stay hidden until camera permission has been granted once.
        let devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
        if (devices.some(d => !d.label)) {
          try {
            const probe = await navigator.mediaDevices.getUserMedia({ video: true });
            probe.getTracks().forEach(t => t.stop());
            devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
          } catch { /* permission denied — continue with whatever labels we have */ }
        }

        const pattern = import.meta.env.VITE_PHONE_CAMERA_DEVICE || 'ivcam|e2esoft|camo|epoccam|phone';
        const re = new RegExp(pattern, 'i');
        const match = devices.find(d => re.test(d.label || ''));

        if (!match) {
          const labels = devices.map(d => d.label || '(unnamed)').join(', ') || 'none';
          updateRt(nodeId, {
            isCameraActive: false,
            streamMode: null,
            cameraError:
              `No phone virtual camera detected (${labels}). Install iVCam or Camo on iPhone + Windows and keep it connected, ` +
              'or set VITE_PHONE_CAMERA_URL / VITE_PHONE_CAMERA_PROXY in web/.env for an MJPEG stream.'
          });
          reportStatus(nodeId, 'ERROR');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: match.deviceId } }
        });
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            stopCamera(nodeId);
            updateRt(nodeId, { cameraError: 'Phone camera stream disconnected.' });
          };
        }
        streamRefs.current[nodeId] = stream;
        const phoneVideo = videoRefs.current[nodeId];
        if (phoneVideo) {
          phoneVideo.srcObject = stream;
          phoneVideo.play().catch(() => {});
        }
        updateRt(nodeId, { isCameraActive: true, streamMode: 'webrtc', cameraError: null });
        reportStatus(nodeId, 'ONLINE');
        startStreamFpsMeter(nodeId);
      } catch (err) {
        console.error('Phone virtual camera error:', err);
        let message = `Phone camera error: ${err.message || 'Unable to open virtual camera.'}`;
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          message = 'Camera permission denied. Allow camera access once, then start the node again.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          message = 'Virtual camera is in use by another application (close Camo/iVCam previews and retry).';
        }
        updateRt(nodeId, { isCameraActive: false, streamMode: null, cameraError: message });
        reportStatus(nodeId, 'ERROR');
      }
      return;
    }

    // --- Laptop webcam node ---
    if (!isWebcamNode(node)) {
      updateRt(nodeId, {
        isCameraActive: false,
        cameraError: `Stream source '${node.streamSource}' is not supported by this browser node.`
      });
      return;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        updateRt(nodeId, { cameraError: 'Webcam access is not supported by your browser.' });
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment'
        }
      });

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopCamera(nodeId);
          updateRt(nodeId, { cameraError: 'Camera stream disconnected unexpectedly.' });
        };
      }

      streamRefs.current[nodeId] = stream;
      const video = videoRefs.current[nodeId];
      if (video) {
        video.srcObject = stream;
        video.play().catch(() => {});
      }
      updateRt(nodeId, { isCameraActive: true, streamMode: 'webrtc', cameraError: null });
      reportStatus(nodeId, 'ONLINE');
      startStreamFpsMeter(nodeId);
    } catch (err) {
      console.error('Camera access error:', err);
      let message = `Camera error: ${err.message || 'Unable to access webcam.'}`;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Camera permission denied. Please allow camera permissions in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No video camera detected on your device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message = 'Camera is currently in use by another application.';
      }
      updateRt(nodeId, { isCameraActive: false, cameraError: message });
      reportStatus(nodeId, 'ERROR');
    }
  }, [nodes, updateRt, reportStatus, stopCamera, startStreamFpsMeter]);

  const captureFrameBlob = useCallback((nodeId) => {
    const video = videoRefs.current[nodeId];
    const img = phoneImgRefs.current[nodeId];
    const canvas = canvasRefs.current[nodeId];
    if (!canvas) return null;

    let source = null;
    if (video && video.readyState >= 2 && video.videoWidth) {
      source = video;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
    } else if (img && img.complete && img.naturalWidth) {
      source = img;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
    }
    if (!source) return null;

    const ctx = canvas.getContext('2d');
    try {
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    } catch (e) {
      return null;
    }

    return new Promise((resolve) => {
      try {
        canvas.toBlob((blob) => {
          let dataUrl = null;
          try {
            dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          } catch (e) {
            // Tainted canvas (cross-origin phone stream without CORS) — blob also unusable.
            resolve({ blob: null, dataUrl: null, corsError: true });
            return;
          }
          resolve({ blob, dataUrl });
        }, 'image/jpeg', 0.85);
      } catch (e) {
        resolve({ blob: null, dataUrl: null, corsError: true });
      }
    });
  }, []);

  const handleCaptureFrame = useCallback(async (nodeId) => {
    if (nodeId == null) return;
    const current = runtime[nodeId] || DEFAULT_RT;
    if (!current.isCameraActive || analyzingRefs.current[nodeId]) return;

    analyzingRefs.current[nodeId] = true;
    updateRt(nodeId, { isAnalyzing: true, cameraError: null });
    reportStatus(nodeId, 'ANALYZING');
    const captureStarted = performance.now();

    try {
      const frameData = await captureFrameBlob(nodeId);
      if (!frameData || (!frameData.blob && !frameData.dataUrl)) {
        updateRt(nodeId, {
          cameraError: frameData?.corsError
            ? 'Cannot capture frames from this phone stream (cross-origin). Configure the camera app to allow CORS.'
            : 'Failed to capture frame from camera stream.'
        });
        return;
      }
      if (frameData.corsError || !frameData.blob) {
        updateRt(nodeId, {
          cameraError: 'Cannot capture frames from this phone stream (cross-origin). Configure the camera app to allow CORS.'
        });
        return;
      }

      updateRt(nodeId, { latestSnapshot: frameData.dataUrl });

      const currentSessionId = sessionRefs.current[nodeId] || '';
      const result = await crimeVehicleService.scanFrame(frameData.blob, currentSessionId, nodeId);
      const clientProcessingMs = Math.round((performance.now() - captureStarted) * 10) / 10;

      // Honest per-frame log + measured AI FPS (real completion timestamp).
      recordAiCompletion(nodeId, result.frameStats, clientProcessingMs, result.detectionStatus || '—');

      if (result.trackingInfo) {
        updateRt(nodeId, {
          trackingStats: {
            activeTracks: result.trackingInfo.totalActiveTracks || 0,
            processedTracks: result.trackingInfo.totalProcessedTracks || 0
          }
        });
      }

      // Count crime vehicles for this node's dashboard (real new matches only, not cooldown re-sights).
      if (result.isMatch && result.detectionStatus === 'POSSIBLE_CRIME_MATCH') {
        updateRt(nodeId, (cur) => ({
          ...cur,
          stats: {
            ...(cur.stats || DEFAULT_STATS),
            crimeVehicles: ((cur.stats || DEFAULT_STATS).crimeVehicles || 0) + 1
          }
        }));
      }

      // Skip displaying already-processed / duplicate / awaiting-confirmation frames
      // (evidence rule: no invented results)
      if (
        result.detectionStatus === 'ALL_VEHICLES_TRACKED' ||
        result.detectionStatus === 'DUPLICATE_PLATE' ||
        result.detectionStatus === 'ALREADY_PROCESSED' ||
        result.detectionStatus === 'AWAITING_CONFIRMATION' ||
        result.isDuplicate
      ) {
        return;
      }

      updateRt(nodeId, { latestResult: result });

      if (result.logId && frameData.dataUrl && onScanComplete) {
        onScanComplete(result.logId, frameData.dataUrl);
      }
    } catch (err) {
      console.error('Frame scan error:', err);
      updateRt(nodeId, { cameraError: 'Failed to process video frame with AI detection service.' });
    } finally {
      analyzingRefs.current[nodeId] = false;
      updateRt(nodeId, { isAnalyzing: false });
      if ((runtime[nodeId] || DEFAULT_RT).isCameraActive) reportStatus(nodeId, 'ONLINE');
    }
  }, [runtime, captureFrameBlob, updateRt, reportStatus, onScanComplete, recordAiCompletion]);

  const startCctvMonitoring = useCallback(async (nodeId) => {
    if (nodeId == null) return;
    const current = runtime[nodeId] || DEFAULT_RT;
    if (!current.isCameraActive) return;

    // Backend-issued node-scoped session: NODE{n}-SESSION-{seq}
    let newSessionId = null;
    if (onStartSession) {
      try {
        newSessionId = await onStartSession(nodeId);
      } catch (e) {
        console.warn('Backend session start failed:', e);
      }
    }
    if (!newSessionId) {
      // Backend offline — local fallback so tracking still works per node.
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
      newSessionId = `CCTV-${dateStr}-${timeStr}-N${nodeId}`;
    }

    sessionRefs.current[nodeId] = newSessionId;
    aiStampRefs.current[nodeId] = [];
    updateRt(nodeId, {
      sessionId: newSessionId,
      trackingStats: { activeTracks: 0, processedTracks: 0 },
      stats: { ...(current.stats || DEFAULT_STATS), aiFps: null, vehicles: 0 },
      isMonitoring: true
    });
    reportStatus(nodeId, 'ONLINE');

    handleCaptureFrame(nodeId);

    // Per-node independent timer at the configured AI sample rate (default 5 FPS = 200ms).
    // Video display stays full stream FPS; only AI sampling is throttled.
    if (intervalRefs.current[nodeId]) clearInterval(intervalRefs.current[nodeId]);
    intervalRefs.current[nodeId] = setInterval(() => {
      if (!analyzingRefs.current[nodeId]) {
        handleCaptureFrame(nodeId);
      }
    }, frameIntervalMs);
  }, [runtime, onStartSession, updateRt, reportStatus, handleCaptureFrame, frameIntervalMs]);

  const handleApproveDetection = async () => {
    if (!rt.latestResult || actionLoading) return;
    setActionLoading(true);
    try {
      const logId = rt.latestResult.logId || `LOG-${Date.now()}`;
      await crimeVehicleService.approveDetection(logId);
      updateRt(activeId, { latestResult: { ...rt.latestResult, validationStatus: 'CONFIRMED_BY_OFFICER' } });
    } catch (e) {
      console.error('Approve error:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectDetection = async () => {
    if (!rt.latestResult || actionLoading) return;
    setActionLoading(true);
    try {
      const logId = rt.latestResult.logId || `LOG-${Date.now()}`;
      await crimeVehicleService.rejectDetection(logId);
      updateRt(activeId, { latestResult: { ...rt.latestResult, validationStatus: 'REJECTED_BY_OFFICER' } });
    } catch (e) {
      console.error('Reject error:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const status = rt.latestResult?.detectionStatus || 'IDLE';
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.IDLE;
  const latestResult = rt.latestResult;
  const latestSnapshot = rt.latestSnapshot;
  const isCameraActive = rt.isCameraActive;
  const isMonitoring = rt.isMonitoring;
  const isAnalyzing = rt.isAnalyzing;
  const cameraError = rt.cameraError;
  const sessionId = rt.sessionId;
  const trackingStats = rt.trackingStats;
  const activePhoneUrl = activeNode ? phoneStreamUrl(activeNode) : '';
  const resultNode = latestResult
    ? nodes.find((n) => n.nodeId === latestResult.nodeId) || activeNode
    : null;

  return (
    <div className="anpr-monitor-container">
      <div className="section-header flex flex-wrap justify-between items-center gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Camera className="text-cyan-400" size={24} />
            AUTOMATIC NUMBER PLATE RECOGNITION (ANPR) SURVEILLANCE
          </h2>
          <p className="text-xs text-slate-400">
            Multi-node CCTV feed with isolated YOLO/ByteTrack tracking per node, {targetAiFps} FPS AI sampling ({frameIntervalMs}ms), multi-frame confirmation & EasyOCR plate voting
          </p>
        </div>
        {latestResult && (
          <span className={`px-3 py-1 rounded-lg text-xs font-mono font-bold ${statusCfg.bg} ${statusCfg.color} border border-current/30`}>
            STATUS: {statusCfg.label}
          </span>
        )}
      </div>

      {/* CCTV node selector */}
      <CCTVNodeGrid
        nodes={nodes}
        activeNodeId={activeId}
        nodeRuntime={runtime}
        targetAiFps={targetAiFps}
        onSelect={onSelectNode}
        onStop={stopCamera}
      />

      {/* Honest AI FPS monitor — measured frame log, no estimated numbers */}
      <FPSMonitorPanel
        frameLog={(activeId != null && runtime[activeId]?.frameLog) || []}
        targetAiFps={targetAiFps}
        frameIntervalMs={frameIntervalMs}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Feed Card */}
        <div className="lg:col-span-2 card bg-slate-900 border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <div>
            <div className="feed-viewport-header flex flex-wrap justify-between items-center pb-3 border-b border-slate-800 gap-2">
              <div className="flex items-center gap-3">
                <div className="relative flex h-3 w-3">
                  {isCameraActive ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-600"></span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {activeNode?.cameraName || 'Select a CCTV node'}
                  </h3>
                  <span className="text-xs text-cyan-400">
                    {activeNode
                      ? `${activeNode.location} • Node ID: ${activeNode.nodeId} • ${activeNode.streamSource}`
                      : 'No node selected'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                {isCameraActive ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 font-mono font-bold flex items-center gap-1">
                    <Circle size={8} className="fill-emerald-400" /> NODE ONLINE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono font-bold">
                    NODE OFFLINE
                  </span>
                )}
                {isMonitoring && (
                  <span className="px-2 py-0.5 rounded bg-cyan-950/90 border border-cyan-400 text-cyan-300 font-mono font-bold animate-pulse">
                    {targetAiFps} FPS MONITORING
                  </span>
                )}
                {isMonitoring && (
                  <span className="px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-400 text-emerald-300 font-mono font-bold" title="Measured AI FPS from real frame completions">
                    AI {rt.stats?.aiFps != null ? rt.stats.aiFps : '—'} FPS
                  </span>
                )}
                {isCameraActive && rt.streamMode === 'webrtc' && rt.stats?.streamFps != null && (
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-600 text-slate-300 font-mono font-bold" title="Measured stream FPS via requestVideoFrameCallback">
                    STREAM {rt.stats.streamFps} FPS
                  </span>
                )}
                {isCameraActive && rt.streamMode === 'mjpeg' && (
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-500 font-mono font-bold" title="MJPEG stream — frame rate not measurable in browser">
                    STREAM — FPS
                  </span>
                )}
                {isMonitoring && sessionId && (
                  <span className="px-2 py-0.5 rounded bg-indigo-950/90 border border-indigo-400 text-indigo-300 font-mono font-bold">
                    TRACKING: {trackingStats.processedTracks} processed
                  </span>
                )}
              </div>
            </div>

            <div className="feed-canvas relative mt-3 rounded-lg overflow-hidden bg-black aspect-video border border-slate-800 flex items-center justify-center">
              {/* Video elements for every node (getUserMedia streams) — all stay mounted; only the active one is visible */}
              {nodes.map((node) => (
                <video
                  key={`video-${node.nodeId}`}
                  ref={(el) => { videoRefs.current[node.nodeId] = el; }}
                  autoPlay
                  playsInline
                  muted
                  className={`absolute inset-0 w-full h-full object-cover ${
                    node.nodeId === activeId &&
                    (runtime[node.nodeId] || DEFAULT_RT).isCameraActive &&
                    (runtime[node.nodeId] || DEFAULT_RT).streamMode === 'webrtc'
                      ? ''
                      : 'hidden'
                  }`}
                />
              ))}

              {/* Phone camera MJPEG stream (real URL only, shown after Start Camera) */}
              {activeNode && isPhoneNode(activeNode) && activePhoneUrl && rt.streamMode === 'mjpeg' && (
                <img
                  ref={(el) => { phoneImgRefs.current[activeNode.nodeId] = el; }}
                  src={activePhoneUrl}
                  alt={`${activeNode.cameraName} phone stream`}
                  className={`absolute inset-0 w-full h-full object-cover ${isCameraActive ? '' : 'hidden'}`}
                  onLoad={() => {
                    updateRt(activeNode.nodeId, { cameraError: null });
                    reportStatus(activeNode.nodeId, 'ONLINE');
                  }}
                  onError={() => {
                    updateRt(activeNode.nodeId, {
                      isCameraActive: false,
                      cameraError: `Phone stream unreachable: ${activePhoneUrl}`
                    });
                    reportStatus(activeNode.nodeId, 'ERROR');
                  }}
                />
              )}

              {nodes.map((node) => (
                <canvas
                  key={`canvas-${node.nodeId}`}
                  ref={(el) => { canvasRefs.current[node.nodeId] = el; }}
                  className="hidden"
                />
              ))}

              {!isCameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-center p-6 overflow-y-auto">
                  {activeNode && isPhoneNode(activeNode) ? (
                    <MobileCameraConnection
                      node={activeNode}
                      streamUrl={activePhoneUrl}
                      onStart={() => startCamera(activeId)}
                    />
                  ) : (
                    <>
                      <div className="p-4 bg-slate-900 rounded-full border border-slate-800 mb-3">
                        <CameraOff size={48} className="text-slate-500" />
                      </div>
                      <h4 className="text-lg font-bold text-white mb-1">CCTV Stream Offline</h4>
                      <p className="text-xs text-slate-400 max-w-md mb-4">
                        Node feed is inactive. Click "Start Camera" to initialize live ANPR surveillance on this node.
                      </p>
                      <button
                        onClick={() => startCamera(activeId)}
                        className="btn bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 shadow-lg transition-all text-xs"
                      >
                        <Camera size={18} /> Start Camera
                      </button>
                    </>
                  )}
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
                  <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-cyan-400 rounded-tl"></div>
                  <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-cyan-400 rounded-tr"></div>
                  <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-cyan-400 rounded-bl"></div>
                  <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-cyan-400 rounded-br"></div>

                  {(isMonitoring || isAnalyzing) && (
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      <div
                        className="scanner-beam-line bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                        style={{ top: `${scannerY}%` }}
                      ></div>
                    </div>
                  )}

                  <div className="absolute top-3 left-3 bg-black/80 backdrop-blur border border-slate-700/80 p-2 rounded text-[11px] font-mono text-cyan-300">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span>NODE {String(activeId ?? '').padStart(2, '0')} STREAM ONLINE</span>
                    </div>
                    <div className="text-slate-400 mt-0.5">YOLO + EasyOCR ANPR | {activeNode?.cameraType} | {targetAiFps} FPS AI</div>
                  </div>

                  {cameraError && (
                    <div className="absolute top-3 right-3 bg-red-950/90 border border-red-500 p-2.5 rounded-lg text-xs text-red-200 pointer-events-auto max-w-xs shadow-xl">
                      <div className="flex items-center gap-1.5 font-bold text-red-400 mb-1">
                        <AlertTriangle size={14} /> Camera Warning
                      </div>
                      {cameraError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800">
            <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center justify-between">
              <span>CCTV NODE & ANPR MONITORING CONTROLS — NODE {String(activeId ?? '--')}</span>
              <span className="text-[11px] font-mono text-cyan-400">
                {isMonitoring ? `STATUS: CONTINUOUS MONITORING (${targetAiFps} FPS)` : isCameraActive ? 'STATUS: READY' : 'STATUS: OFFLINE'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => startCamera(activeId)}
                disabled={isCameraActive}
                className={`btn text-xs px-3.5 py-2 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                  isCameraActive
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                }`}
              >
                <Camera size={15} /> Start Camera
              </button>

              <button
                onClick={() => stopCamera(activeId)}
                disabled={!isCameraActive}
                className={`btn text-xs px-3.5 py-2 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                  !isCameraActive
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-red-600/80 hover:bg-red-600 text-white border border-red-500/50'
                }`}
              >
                <CameraOff size={15} /> Stop Camera
              </button>

              <button
                onClick={() => handleCaptureFrame(activeId)}
                disabled={!isCameraActive || isAnalyzing}
                className={`btn text-xs px-3.5 py-2 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                  !isCameraActive || isAnalyzing
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-amber-600 hover:bg-amber-500 text-white shadow-md'
                }`}
                title="Analyze current node frame through AI detection pipeline"
              >
                {isAnalyzing ? <RefreshCw size={15} className="animate-spin" /> : <Zap size={15} />}
                Capture Frame
              </button>

              <button
                onClick={() => startCctvMonitoring(activeId)}
                disabled={!isCameraActive || isMonitoring}
                className={`btn text-xs px-3.5 py-2 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                  !isCameraActive || isMonitoring
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md'
                }`}
              >
                <Play size={15} /> Start CCTV Monitoring
              </button>

              <button
                onClick={() => stopCctvMonitoring(activeId)}
                disabled={!isMonitoring}
                className={`btn text-xs px-3.5 py-2 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                  !isMonitoring
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600'
                }`}
              >
                <Pause size={15} /> Stop CCTV Monitoring
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Agent Pipeline & Results */}
        <div className="card bg-slate-900 border-slate-800 p-4 rounded-xl flex flex-col justify-between overflow-y-auto max-h-[720px]">
          <div>
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Cpu size={18} className="text-cyan-400" />
                CONTROLLED AGENTIC AI PIPELINE
              </h3>
              {isMonitoring && (
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                  LIVE REFRESH {targetAiFps} FPS
                </span>
              )}
            </div>

            {/* Pipeline Stages */}
            <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 mb-4 text-xs font-mono space-y-1.5">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                <FileCheck size={12} className="text-cyan-400" /> Agent Processing Pipeline Stages
              </div>

              <div className="flex items-center gap-2 text-emerald-400">
                <Check size={13} className="shrink-0" />
                <span className="truncate">Coordinator Agent: Frame Captured (Node {activeId ?? '--'})</span>
              </div>

              <div className={`flex items-center gap-2 ${isAnalyzing ? 'text-amber-400 animate-pulse' : latestResult?.vehicleDetected ? 'text-emerald-400' : latestResult ? 'text-slate-400' : 'text-slate-500'}`}>
                {isAnalyzing ? <Loader2 size={13} className="animate-spin shrink-0" /> : latestResult?.vehicleDetected ? <Check size={13} className="shrink-0" /> : latestResult ? <XCircle size={13} className="shrink-0" /> : <Circle size={10} className="shrink-0" />}
                <span className="truncate">
                  Vehicle Detection (YOLO): {isAnalyzing ? 'Running...' : latestResult?.vehicleDetected ? 'Vehicle Found' : latestResult ? 'No Vehicle' : 'Pending'}
                </span>
              </div>

              <div className={`flex items-center gap-2 ${latestResult?.plateDetected ? 'text-emerald-400' : latestResult ? 'text-slate-400' : 'text-slate-500'}`}>
                {latestResult?.plateDetected ? <Check size={13} className="shrink-0" /> : latestResult ? <XCircle size={13} className="shrink-0" /> : <Circle size={10} className="shrink-0" />}
                <span className="truncate">
                  Plate OCR: {latestResult?.plateDetected ? latestResult.detectedPlate : latestResult ? 'No Plate Read' : 'Pending'}
                </span>
              </div>

              <div className={`flex items-center gap-2 ${latestResult?.isMatch ? 'text-red-400 font-bold' : latestResult ? 'text-emerald-400' : 'text-slate-500'}`}>
                {latestResult ? <Database size={13} className="shrink-0" /> : <Circle size={10} className="shrink-0" />}
                <span className="truncate">
                  DB Match: {latestResult ? (latestResult.isMatch ? 'MATCH FOUND' : 'CLEARED') : 'Pending'}
                </span>
              </div>

              <div className={`flex items-center gap-2 ${latestResult?.isMatch ? 'text-amber-400 font-bold' : latestResult ? 'text-emerald-400' : 'text-slate-500'}`}>
                {latestResult?.isMatch ? <AlertTriangle size={13} className="shrink-0" /> : latestResult ? <Check size={13} className="shrink-0" /> : <Circle size={10} className="shrink-0" />}
                <span className="truncate">
                  Safety Agent: {latestResult?.validationStatus === 'CONFIRMED_BY_OFFICER' ? 'OFFICER CONFIRMED' : latestResult?.validationStatus === 'REJECTED_BY_OFFICER' ? 'OFFICER REJECTED' : latestResult?.isMatch ? 'REQUIRES REVIEW' : latestResult ? 'AUTO CLEARED' : 'Pending'}
                </span>
              </div>

              {isMonitoring && sessionId && (
                <div className="flex items-center gap-2 text-indigo-400">
                  <Eye size={13} className="shrink-0" />
                  <span className="truncate">
                    ByteTrack: {trackingStats.activeTracks} active / {trackingStats.processedTracks} processed | Session: {sessionId}
                  </span>
                </div>
              )}
            </div>

            {/* Analyzing State */}
            {isAnalyzing ? (
              <div className="p-6 bg-slate-950/80 rounded-xl border border-cyan-500/40 text-center py-8 my-2">
                <Loader2 size={36} className="animate-spin text-cyan-400 mx-auto mb-3" />
                <h4 className="font-bold text-white text-sm">Analyzing current frame...</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Forwarding frame from Node {activeId} to Python AI service (YOLO vehicle detection + EasyOCR plate reading + PostgreSQL lookup).
                </p>
              </div>
            ) : latestResult ? (
              /* Result Display */
              <div className="space-y-3">
                {latestSnapshot && (
                  <div className="relative rounded-lg overflow-hidden border border-slate-800 aspect-video bg-black">
                    <img src={latestSnapshot} alt="Captured Frame" className="w-full h-full object-cover" />
                    <div className="absolute top-2 left-2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono text-cyan-300">
                      NODE {latestResult.nodeId || activeId} CAPTURE FRAME
                    </div>
                    <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${statusCfg.bg} ${statusCfg.color}`}>
                      {statusCfg.label}
                    </div>
                  </div>
                )}

                {/* Detection Data */}
                <div className="space-y-2 text-xs">
                  {/* Plate Display */}
                  <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700/80 flex justify-between items-center">
                    <div>
                      <div className="text-[11px] text-slate-400">Detected Number Plate</div>
                      <div className="font-mono text-xl font-black text-amber-400">
                        {latestResult.detectedPlate && !['NO_VEHICLE_DETECTED', 'NO_PLATE_DETECTED', 'ERROR'].includes(latestResult.detectedPlate)
                          ? latestResult.detectedPlate
                          : '—'}
                      </div>
                    </div>
                    {latestResult.plateConfidence > 0 && (
                      <div className="text-right">
                        <div className="text-[11px] text-slate-400">Plate OCR Conf.</div>
                        <div className="font-mono text-sm font-bold text-emerald-400">{latestResult.plateConfidence}%</div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 bg-slate-800/60 rounded-lg border border-slate-700/80">
                      <span className="text-slate-400 text-[11px] block">Vehicle Info</span>
                      <span className="font-bold text-slate-200 text-[11px] leading-tight block">{latestResult.vehicleInfo || 'No data'}</span>
                    </div>
                    <div className="p-2.5 bg-slate-800/60 rounded-lg border border-slate-700/80">
                      <span className="text-slate-400 text-[11px] block">Vehicle Confidence</span>
                      <span className="font-mono text-emerald-400 font-bold">{latestResult.vehicleConfidence > 0 ? `${latestResult.vehicleConfidence}%` : '—'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 bg-slate-800/60 rounded-lg border border-slate-700/80">
                      <span className="text-slate-400 text-[11px] block">Crime Database</span>
                      <span className={`font-bold font-mono ${latestResult.isMatch ? 'text-red-400' : 'text-emerald-400'}`}>
                        {latestResult.isMatch ? 'MATCH FOUND' : 'NO MATCH'}
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-800/60 rounded-lg border border-slate-700/80">
                      <span className="text-slate-400 text-[11px] block">Crime Status</span>
                      <span className={`font-bold text-[11px] ${latestResult.isMatch ? 'text-red-400' : 'text-slate-200'}`}>
                        {latestResult.crimeStatus || 'CLEARED'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 bg-slate-800/60 rounded-lg border border-slate-700/80">
                      <span className="text-slate-400 text-[11px] block">Source Node</span>
                      <span className="font-mono text-cyan-400 font-bold">
                        NODE {latestResult.nodeId || activeId} — {resultNode?.cameraName || 'Unknown'}
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-800/60 rounded-lg border border-slate-700/80">
                      <span className="text-slate-400 text-[11px] block">Track / Session</span>
                      <span className="font-mono text-indigo-300 font-bold text-[10px] break-all">
                        {latestResult.trackId != null ? `T${latestResult.trackId}` : '—'} | {latestResult.sessionId || sessionId || '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cooldown-suppressed crime match — CrimeMatch retained, re-alert suppressed */}
                {latestResult.isMatch && status === 'COOLDOWN_SUPPRESSED' && (
                  <div className="p-4 bg-amber-950/80 border border-amber-500/70 rounded-xl text-amber-200 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-amber-400 text-sm">
                      <ShieldAlert className="shrink-0" size={18} />
                      Crime match retained — re-alert suppressed (cooldown {cfg.alertCooldownSeconds || 60}s)
                    </div>
                    <div className="text-[11px] font-mono text-amber-300">
                      Node {latestResult.nodeId || activeId} — {resultNode?.cameraName || activeNode?.cameraName || 'Unknown node'}
                    </div>
                    {latestResult.matchedVehicle && (
                      <div className="text-xs space-y-1">
                        <p><strong>Plate:</strong> {latestResult.matchedVehicle.plateNumber}</p>
                        <p><strong>Vehicle:</strong> {latestResult.matchedVehicle.makeModel} ({latestResult.matchedVehicle.color})</p>
                        <p><strong>Incident:</strong> {latestResult.matchedVehicle.incidentType}</p>
                      </div>
                    )}
                    <p className="text-[11px] text-amber-200/80 leading-snug">
                      Same plate + node was alerted within the cooldown window. No new officer-review alert was raised.
                    </p>
                  </div>
                )}

                {/* Crime Match Alert */}
                {latestResult.isMatch && status !== 'COOLDOWN_SUPPRESSED' ? (
                  <div className="p-4 bg-red-950/90 border border-red-500/80 rounded-xl text-red-200 space-y-3">
                    <div className="flex items-center gap-2 font-bold text-red-400 text-sm">
                      <ShieldAlert className="animate-pulse shrink-0" size={18} />
                      Possible crime-related vehicle detected
                    </div>
                    <div className="text-[11px] font-mono text-red-300">
                      Node {latestResult.nodeId || activeId} — {resultNode?.cameraName || activeNode?.cameraName || 'Unknown node'}
                    </div>
                    {latestResult.matchedVehicle && (
                      <div className="text-xs space-y-1">
                        <p><strong>Plate:</strong> {latestResult.matchedVehicle.plateNumber}</p>
                        <p><strong>Vehicle:</strong> {latestResult.matchedVehicle.makeModel} ({latestResult.matchedVehicle.color})</p>
                        <p><strong>Incident:</strong> {latestResult.matchedVehicle.incidentType}</p>
                        <p><strong>Threat:</strong> {latestResult.matchedVehicle.threatLevel}</p>
                      </div>
                    )}
                    <p className="text-xs text-red-200 leading-snug">
                      Requires authorized officer verification before final criminal record entry.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={handleApproveDetection}
                        disabled={actionLoading || latestResult.validationStatus === 'CONFIRMED_BY_OFFICER'}
                        className={`btn flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-md ${
                          latestResult.validationStatus === 'CONFIRMED_BY_OFFICER'
                            ? 'bg-emerald-800 text-emerald-200 cursor-default'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        <UserCheck size={14} />
                        {latestResult.validationStatus === 'CONFIRMED_BY_OFFICER' ? 'Confirmed ✓' : 'Confirm Detection'}
                      </button>
                      <button
                        onClick={handleRejectDetection}
                        disabled={actionLoading || latestResult.validationStatus === 'REJECTED_BY_OFFICER'}
                        className={`btn flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-md ${
                          latestResult.validationStatus === 'REJECTED_BY_OFFICER'
                            ? 'bg-slate-800 text-slate-400 cursor-default'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                        }`}
                      >
                        <UserX size={14} />
                        {latestResult.validationStatus === 'REJECTED_BY_OFFICER' ? 'Rejected ✗' : 'Reject Detection'}
                      </button>
                    </div>
                    {latestResult.validationStatus === 'CONFIRMED_BY_OFFICER' && (
                      <button
                        onClick={() =>
                          onOpenDispatch({
                            id: latestResult.logId || `CCTV-${Date.now()}`,
                            plateNumber: latestResult.detectedPlate,
                            cameraName: resultNode?.cameraName || `Node ${latestResult.nodeId || activeId}`,
                            vehicleDetails: latestResult.vehicleInfo,
                            timestamp: latestResult.scannedAt
                          })
                        }
                        className="btn bg-red-600 hover:bg-red-500 text-white w-full py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg"
                      >
                        <AlertTriangle size={15} /> Trigger Intercept Patrol Dispatch
                      </button>
                    )}
                  </div>
                ) : (
                  /* Non-match result messages */
                  <div className={`p-3 rounded-xl border ${
                    status === 'NO_VEHICLE' || status === 'PERSON_DETECTED'
                      ? 'bg-slate-800/60 border-slate-700 text-slate-300'
                      : status === 'VEHICLE_DETECTED_NO_PLATE' || status === 'PLATE_UNREADABLE'
                        ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                        : status === 'AI_SERVICE_UNAVAILABLE' || status === 'ERROR'
                          ? 'bg-red-950/60 border-red-500/50 text-red-300'
                          : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                  }`}>
                    <div className="flex items-center gap-2 font-bold text-xs">
                      {status === 'NO_VEHICLE' && <><Circle size={16} /> No vehicle detected</>}
                      {status === 'PERSON_DETECTED' && <><User size={16} /> Person detected — No vehicle</>}
                      {status === 'VEHICLE_DETECTED_NO_PLATE' && <><AlertTriangle size={16} /> Vehicle detected, no readable plate</>}
                      {status === 'PLATE_UNREADABLE' && <><AlertTriangle size={16} /> License plate unreadable</>}
                      {status === 'AWAITING_CONFIRMATION' && <><Circle size={16} /> Awaiting multi-frame confirmation ({cfg.confirmationFrames || 3} frames)</>}
                      {status === 'NO_CRIME_MATCH' && <><CheckCircle size={16} /> Vehicle cleared</>}
                      {(status === 'AI_SERVICE_UNAVAILABLE' || status === 'ERROR') && <><XCircle size={16} /> Service error</>}
                      {status === 'IDLE' && <><CheckCircle size={16} /> Ready</>}
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1">{latestResult.vehicleInfo || 'No additional information.'}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400 text-xs px-4">
                <Cpu size={40} className="mx-auto mb-3 opacity-30 text-cyan-400" />
                <p className="font-medium text-slate-300 mb-1">
                  {isCameraActive ? 'Pipeline Ready' : 'CCTV Stream Offline'}
                </p>
                <p className="text-slate-500">
                  {isCameraActive
                    ? 'Click "Capture Frame" or "Start CCTV Monitoring" to dispatch frames to the AI detection pipeline.'
                    : 'Click "Start Camera" to initialize this node\'s live stream.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
