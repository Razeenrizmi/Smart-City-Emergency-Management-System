import React from 'react';
import { Smartphone, QrCode, Camera, Play } from 'lucide-react';

/**
 * Connection guide for the phone-camera CCTV node.
 * Shows the configured stream URL from VITE_PHONE_CAMERA_URL / node.StreamUrl.
 * Never fabricates a stream — if no URL is configured, only setup instructions are shown.
 */
export default function MobileCameraConnection({ node, streamUrl, onStart }) {
  return (
    <div className="p-4 bg-slate-950/90 rounded-lg border border-slate-800 text-center max-w-md mx-auto">
      <div className="p-3 bg-slate-900 rounded-full border border-slate-800 w-fit mx-auto mb-3">
        <Smartphone size={36} className="text-cyan-400" />
      </div>
      <h4 className="text-sm font-bold text-white mb-1 flex items-center justify-center gap-2">
        <Camera size={14} className="text-cyan-400" />
        {node?.cameraName || 'Phone Camera Node'} — Not Connected
      </h4>

      {streamUrl ? (
        <>
          <p className="text-xs text-slate-400 mb-3">
            Stream URL configured. Click Start Camera to connect — the feed is loaded
            through the Vite <code className="text-cyan-400">/phonecam</code> proxy (same-origin)
            so AI frame capture works without CORS errors.
          </p>
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-2 mb-3 font-mono text-[11px] text-cyan-300 break-all">
            {streamUrl}
          </div>
          <button
            onClick={() => onStart?.()}
            className="btn bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg font-semibold inline-flex items-center gap-2 text-xs"
          >
            <Camera size={14} /> Start Phone Camera Node
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-slate-400 mb-3">
            Connect your iPhone as <strong>Node 2</strong> using one of these two real methods:
          </p>

          <div className="text-left bg-slate-900 border border-slate-700 rounded-lg p-3 mb-2 text-[11px] text-slate-300 space-y-1">
            <div className="font-bold text-cyan-400 text-[10px] uppercase">Method A — MJPEG stream URL</div>
            <span>
              1. On the iPhone (same Wi-Fi), run an MJPEG server app (e.g. SimpleIPCamera).<br />
              2. Open its URL in a desktop browser to verify the live picture.<br />
              3. In <code className="text-cyan-400">web/.env</code> set{' '}
              <code className="text-cyan-400">VITE_PHONE_CAMERA_PROXY=http://&lt;iphone-ip&gt;:&lt;port&gt;</code> and{' '}
              <code className="text-cyan-400">VITE_PHONE_CAMERA_URL=/phonecam/&lt;path&gt;</code>, then restart{' '}
              <code className="text-cyan-400">npm run dev</code>.
            </span>
          </div>

          <div className="text-left bg-slate-900 border border-slate-700 rounded-lg p-3 mb-2 text-[11px] text-slate-300 space-y-1">
            <div className="font-bold text-emerald-400 text-[10px] uppercase">Method B — Virtual webcam (recommended)</div>
            <span>
              1. Install <strong>iVCam</strong> or <strong>Camo</strong> on the iPhone and the Windows client on this PC.<br />
              2. Pair them (same Wi-Fi or USB) and keep both apps running.<br />
              3. Click <em>Start Camera</em> — Node 2 opens the virtual camera automatically.
            </span>
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 text-slate-500">
            <QrCode size={28} />
            <span className="text-[10px] font-mono">NO FAKE STREAM — REAL CAMERA REQUIRED</span>
          </div>

          <button
            onClick={() => onStart?.()}
            className="btn bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg font-semibold inline-flex items-center gap-2 text-xs mt-3"
          >
            <Play size={14} /> Start Camera (detects Method B automatically)
          </button>
        </>
      )}
    </div>
  );
}
