import { useEffect, useRef, useState } from 'react';
import CongestionBadge from './CongestionBadge';
import TrafficLightIndicator from './TrafficLightIndicator';
import LiveDetectionPreview from './LiveDetectionPreview';
import './DirectionUploadCard.css';

const STATUS_LABEL = {
  empty: 'No footage uploaded',
  ready: 'Footage ready to scan',
  scanning: 'Scanning footage…',
  scanned: 'Scan complete',
  error: 'Scan failed',
};

// How long a "connect camera" recording runs before it's handed off to the
// same scanning pipeline as an uploaded clip — long enough to give the
// direction-tracking logic a few genuinely different frames to compare.
const RECORD_SECONDS = 8;

export default function DirectionUploadCard({ state, phase, onFileSelected, onRename, disabled }) {
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const recordTimeoutRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const cancelledRef = useRef(false);

  // idle | requesting | recording | error
  const [cameraStatus, setCameraStatus] = useState('idle');
  const [cameraError, setCameraError] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(RECORD_SECONDS);

  function stopCameraStream() {
    clearTimeout(recordTimeoutRef.current);
    clearInterval(countdownIntervalRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  // Release the camera the moment this card unmounts (road count change,
  // navigating away) rather than leaving the device's camera light on.
  useEffect(() => stopCameraStream, []);

  function handleChange(event) {
    const file = event.target.files?.[0];
    if (file) onFileSelected(file);
    event.target.value = '';
  }

  async function connectCamera() {
    setCameraStatus('requesting');
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      // Start capturing the moment the camera connects — no extra click
      // needed to get live footage flowing into the scan.
      startRecording(stream);
    } catch {
      setCameraStatus('error');
      setCameraError("Couldn't access the camera — check permissions and that no other app is using it.");
    }
  }

  function startRecording(stream) {
    if (!stream) return;

    // vp8 first: the most broadly reliable codec for a clip that needs to
    // be immediately decodable again a moment after recording — some
    // vp9 hardware-encode paths have produced files that briefly fail to
    // load right after being written.
    const mimeType = ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'].find(
      (type) => window.MediaRecorder?.isTypeSupported(type),
    );
    if (!mimeType) {
      setCameraStatus('error');
      setCameraError("This browser can't record video.");
      return;
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const wasCancelled = cancelledRef.current;
      cancelledRef.current = false;
      stopCameraStream();
      setCameraStatus('idle');
      if (wasCancelled) return;

      const blob = new Blob(chunks, { type: mimeType });
      const file = new File([blob], `camera-${Date.now()}.webm`, { type: mimeType });
      onFileSelected(file);
    };

    recorderRef.current = recorder;
    recorder.start();
    setCameraStatus('recording');
    setSecondsLeft(RECORD_SECONDS);

    countdownIntervalRef.current = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    recordTimeoutRef.current = setTimeout(() => {
      clearInterval(countdownIntervalRef.current);
      recorder.stop();
    }, RECORD_SECONDS * 1000);
  }

  function cancelCamera() {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      cancelledRef.current = true;
      clearTimeout(recordTimeoutRef.current);
      clearInterval(countdownIntervalRef.current);
      recorderRef.current.stop();
    } else {
      stopCameraStream();
      setCameraStatus('idle');
    }
  }

  const cameraActive = cameraStatus !== 'idle';

  return (
    <div className={`direction-card direction-card--${state.status}`}>
      <div className="direction-card__header">
        <input
          type="text"
          className="direction-card__name-input"
          value={state.name}
          onChange={(e) => onRename(e.target.value)}
          disabled={disabled}
          aria-label="Road name"
        />
        <TrafficLightIndicator phase={phase} />
      </div>

      {cameraActive ? (
        <div className="direction-card__camera">
          <video ref={videoRef} className="direction-card__camera-video" muted playsInline />
          {cameraStatus === 'recording' && (
            <span className="direction-card__camera-badge">● Recording… {secondsLeft}s</span>
          )}
        </div>
      ) : state.previewUrl ? (
        <LiveDetectionPreview key={state.previewUrl} previewUrl={state.previewUrl} />
      ) : (
        <div className="direction-card__placeholder">No CCTV clip selected</div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="direction-card__file-input"
        onChange={handleChange}
        disabled={disabled}
        aria-label={`Upload CCTV footage for ${state.name}`}
      />

      {cameraStatus === 'idle' && (
        <div className="direction-card__actions">
          <button
            type="button"
            className="direction-card__upload-btn"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            {state.file ? 'Replace footage' : 'Upload footage'}
          </button>
          <button
            type="button"
            className="direction-card__camera-btn"
            onClick={connectCamera}
            disabled={disabled}
          >
            Connect camera
          </button>
        </div>
      )}

      {cameraStatus === 'requesting' && (
        <p className="direction-card__status">Connecting to camera…</p>
      )}

      {cameraStatus === 'recording' && (
        <div className="direction-card__actions">
          <button type="button" className="direction-card__cancel-btn" onClick={cancelCamera}>
            Cancel recording
          </button>
        </div>
      )}

      {cameraStatus === 'error' && <p className="direction-card__error">{cameraError}</p>}

      {!cameraActive && <p className="direction-card__status">{STATUS_LABEL[state.status]}</p>}

      {!cameraActive && state.status === 'error' && (
        <p className="direction-card__error">{state.error}</p>
      )}

      {!cameraActive && state.status === 'scanned' && (
        <div className="direction-card__result">
          <div className="direction-card__result-stats">
            <span className="direction-card__count">{state.vehicleCount} vehicles</span>
            <CongestionBadge level={state.congestionLevel} />
          </div>
          {state.thumbnail && (
            <img
              className="direction-card__thumbnail"
              src={state.thumbnail}
              alt={`Peak detection frame for ${state.name}`}
            />
          )}
        </div>
      )}
    </div>
  );
}
