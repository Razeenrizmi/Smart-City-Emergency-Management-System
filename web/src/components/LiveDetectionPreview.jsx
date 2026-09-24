import { useEffect, useRef, useState } from 'react';
import {
  detectVehiclesOnce,
  drawDetections,
  fixInfiniteDuration,
  loadDetectionModel,
} from '../lib/vehicleDetection';
import './LiveDetectionPreview.css';

// Plays the uploaded clip normally and overlays live bounding boxes + a
// running vehicle count while it plays — a visual "watch the AI work" demo
// aid. This uses a single full-frame detection pass per animation frame
// (see detectVehiclesOnce), not the tiled multi-sample scan that produces
// the authoritative count used for the signal decision — that trade-off is
// what keeps this smooth enough to feel live.
//
// Render this with key={previewUrl} at the call site: a new clip needs a
// full remount (fresh refs, stopped loop), not a state reset in an effect.
export default function LiveDetectionPreview({ previewUrl }) {
  const wrapperRef = useRef(null);
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(null);
  const activeRef = useRef(false);

  const [status, setStatus] = useState('idle'); // idle | loading | running | error
  const [liveCount, setLiveCount] = useState(null);

  useEffect(
    () => () => {
      activeRef.current = false;
      cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  function handleLoadedMetadata() {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) return;

    // A "connect camera" recording commonly reports duration as
    // Infinity/NaN at this point (Chrome hasn't indexed the blob yet),
    // which leaves the video frozen/black until fixed — do this now,
    // before the viewer even presses play, so playback just works.
    fixInfiniteDuration(video);

    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
    if (!captureCanvasRef.current) captureCanvasRef.current = document.createElement('canvas');
    captureCanvasRef.current.width = video.videoWidth;
    captureCanvasRef.current.height = video.videoHeight;

    // Match the wrapper's aspect ratio to the real clip so the overlay
    // canvas (which has no "object-fit: cover" equivalent of its own)
    // lines up pixel-for-pixel with the video underneath instead of being
    // stretched to a different box shape.
    if (wrapperRef.current) {
      wrapperRef.current.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
    }
  }

  function loop() {
    if (!activeRef.current) return;

    const video = videoRef.current;
    const overlay = overlayRef.current;
    const capture = captureCanvasRef.current;

    if (video && overlay && capture && !video.paused && !video.ended) {
      const captureCtx = capture.getContext('2d');
      captureCtx.drawImage(video, 0, 0, capture.width, capture.height);

      const vehicles = detectVehiclesOnce(detectorRef.current, capture);

      const overlayCtx = overlay.getContext('2d');
      overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
      drawDetections(overlayCtx, vehicles);
      setLiveCount(vehicles.length);
    }

    rafRef.current = requestAnimationFrame(loop);
  }

  function startLive() {
    const video = videoRef.current;
    if (!video) return;

    activeRef.current = true;
    setStatus('loading');

    // Call play() synchronously, in direct response to the click, before
    // awaiting anything — the browser only treats play() as
    // user-authorized for a brief window after a real gesture. Loading
    // the model first (which can take a few seconds on an uncached first
    // use) would burn through that window and cause play() to be silently
    // blocked, leaving the video paused with the toggle stuck on "running".
    video.currentTime = 0;
    video.play().catch(() => {
      // Autoplay can still be blocked in unusual embedding contexts;
      // native controls remain available as a fallback either way.
    });

    loadDetectionModel()
      .then((detector) => {
        if (!activeRef.current) return; // stopped/unmounted while loading
        detectorRef.current = detector;
        setStatus('running');
        loop();
      })
      .catch(() => {
        if (activeRef.current) setStatus('error');
      });
  }

  function stopLive() {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    videoRef.current?.pause();
    setStatus('idle');
    setLiveCount(null);
    const overlay = overlayRef.current;
    if (overlay) overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
  }

  function handleEnded() {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    setStatus('idle');
  }

  return (
    <div className="live-preview">
      <div className="live-preview__frame" ref={wrapperRef}>
        <video
          ref={videoRef}
          className="live-preview__video"
          src={previewUrl}
          controls
          muted
          playsInline
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />
        <canvas ref={overlayRef} className="live-preview__canvas" />
        {status === 'running' && liveCount !== null && (
          <span className="live-preview__badge">
            Live: {liveCount} vehicle{liveCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <button
        type="button"
        className="live-preview__toggle"
        onClick={status === 'running' ? stopLive : startLive}
        disabled={status === 'loading'}
      >
        {status === 'running'
          ? 'Stop live detect'
          : status === 'loading'
            ? 'Loading model…'
            : 'Live detect'}
      </button>
      {status === 'error' && (
        <p className="live-preview__error">Couldn't load the detection model.</p>
      )}
    </div>
  );
}
