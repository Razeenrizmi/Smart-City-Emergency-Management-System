import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Map, AlertTriangle, Shield,
  Navigation, LocateFixed, Camera, MapPin, Loader2
} from 'lucide-react';

const cameraIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">
    <defs>
      <filter id="shadow" x="-30%" y="-20%" width="160%" height="160%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.5"/>
      </filter>
    </defs>
    <path d="M20 2C10.06 2 2 10.06 2 20c0 13 18 28 18 28s18-15 18-28C38 10.06 29.94 2 20 2z" fill="#22c55e" filter="url(#shadow)"/>
    <circle cx="20" cy="18" r="9" fill="white" opacity="0.95"/>
    <circle cx="20" cy="18" r="5" fill="#22c55e"/>
    <circle cx="20" cy="18" r="2" fill="white" opacity="0.6"/>
  </svg>`,
  className: 'camera-marker-icon',
  iconSize: [40, 50],
  iconAnchor: [20, 50],
  popupAnchor: [0, -50]
});

function LocateUser({ onLocationFound, onLocationError }) {
  const map = useMap();
  const hasLocatedRef = useRef(false);
  const onFoundRef = useRef(onLocationFound);
  const onErrorRef = useRef(onLocationError);

  useEffect(() => {
    onFoundRef.current = onLocationFound;
    onErrorRef.current = onLocationError;
  }, [onLocationFound, onLocationError]);

  useEffect(() => {
    let active = true;

    const handleFound = (e) => {
      if (!active) return;
      if (!hasLocatedRef.current) {
        hasLocatedRef.current = true;
        const { lat, lng, accuracy } = e.latlng;
        if (onFoundRef.current) onFoundRef.current({ lat, lng, accuracy });
        map.flyTo([lat, lng], 16, { duration: 1 });
      }
    };

    const handleError = () => {
      if (!active) return;
      if (!hasLocatedRef.current) {
        hasLocatedRef.current = true;
        if (onErrorRef.current) onErrorRef.current();
      }
    };

    const handleRetry = () => {
      hasLocatedRef.current = false;
      map.locate({ setView: false, maxZoom: 16 });
    };

    map.on('locationfound', handleFound);
    map.on('locationerror', handleError);
    window.addEventListener('retry-geolocation', handleRetry);

    map.locate({ setView: false, maxZoom: 16 });

    return () => {
      active = false;
      map.off('locationfound', handleFound);
      map.off('locationerror', handleError);
      window.removeEventListener('retry-geolocation', handleRetry);
    };
  }, [map]);

  return null;
}

export default function CameraNetworkMap({ cameras = [], logs = [], hotlist = [], onOpenDispatch }) {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const matchLogs = logs.filter(l => l.isHotlistMatch);

  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyAFpWqcupJaexQqMYN_i1AMNz8RW7rSslg';
  const googleTileUrl = `https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}${googleApiKey ? `&key=${googleApiKey}` : ''}`;

  const defaultCenter = [6.9271, 79.8612];

  const handleLocationFound = useCallback((loc) => {
    setLocation(loc);
    setLoading(false);
    setError(false);
  }, []);

  const handleLocationError = useCallback(() => {
    setLoading(false);
    setError(true);
    setLocation({ lat: 6.9271, lng: 79.8612, accuracy: 100 });
  }, []);

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(false);
    setLocation(null);
    window.dispatchEvent(new Event('retry-geolocation'));
  }, []);

  return (
    <div className="camera-network-map-container space-y-4">
      {/* Header */}
      <div className="section-header flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Map className="text-cyan-400" size={24} />
            WEBCAM LOCATION MAP
          </h2>
          <p className="text-xs text-slate-400">
            Real GPS location of your webcam device
          </p>
        </div>

        <div className="flex items-center gap-3">
          {location && (
            <span className="badge bg-emerald-950/60 text-emerald-400 border border-emerald-500/40 text-xs flex items-center gap-1">
              <MapPin size={12} />
              {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
            </span>
          )}
          <button
            onClick={handleRetry}
            className="btn bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 border border-slate-700"
          >
            <LocateFixed size={14} />
            {loading ? 'Locating...' : 'Refresh Location'}
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="card bg-slate-900 border-slate-800 overflow-hidden rounded-xl relative" style={{ height: '500px' }}>
        {loading && (
          <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur">
            <Loader2 size={36} className="text-cyan-400 animate-spin mb-3" />
            <p className="text-sm text-slate-300 font-medium">Detecting webcam GPS location...</p>
            <p className="text-xs text-slate-500 mt-1">Please allow location access when prompted</p>
          </div>
        )}

        <MapContainer
          center={defaultCenter}
          zoom={16}
          className="w-full h-full"
          style={{ height: '500px', background: '#e5e3df' }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://maps.google.com">Google Maps</a>'
            url={googleTileUrl}
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
            maxZoom={20}
            minZoom={3}
          />
          <LocateUser onLocationFound={handleLocationFound} onLocationError={handleLocationError} />

          {location && (
            <>
              <Marker
                position={[location.lat, location.lng]}
                icon={cameraIcon}
              >
                <Popup maxWidth={300}>
                  <div className="p-1 min-w-[220px]" style={{ color: '#1e293b' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Camera size={18} style={{ color: '#22c55e' }} />
                      <div>
                        <div className="font-bold text-sm" style={{ color: '#0f172a' }}>Webcam Location</div>
                        <div className="text-[11px]" style={{ color: '#64748b' }}>CAM-101 • Downtown Central</div>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                      <div className="flex justify-between">
                        <span style={{ color: '#64748b' }}>Status</span>
                        <span className="font-bold" style={{ color: '#22c55e' }}>Online</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: '#64748b' }}>Latitude</span>
                        <span className="font-mono" style={{ color: '#334155' }}>{location.lat.toFixed(6)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: '#64748b' }}>Longitude</span>
                        <span className="font-mono" style={{ color: '#334155' }}>{location.lng.toFixed(6)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: '#64748b' }}>Accuracy</span>
                        <span className="font-mono" style={{ color: '#334155' }}>~{Math.round(location.accuracy)}m</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: '#64748b' }}>Source</span>
                        <span style={{ color: '#334155' }}>Browser GPS</span>
                      </div>
                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '6px', marginTop: '4px' }}>
                        <span className="text-[11px]" style={{ color: '#64748b' }}>
                          This is your device's real location used for ANPR scanning
                        </span>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            </>
          )}
        </MapContainer>

        {/* Status overlay */}
        {error && (
          <div className="absolute bottom-3 left-3 z-[1000] bg-amber-950/95 backdrop-blur border border-amber-500/50 rounded-lg p-3 max-w-xs">
            <div className="flex items-center gap-2 text-xs text-amber-300">
              <AlertTriangle size={14} />
              <span className="font-bold">Location access denied</span>
            </div>
            <p className="text-[11px] text-amber-400/70 mt-1">
              Using default location. Enable GPS in browser settings for accurate webcam location.
            </p>
          </div>
        )}

        {location && !loading && (
          <div className="absolute bottom-3 left-3 z-[1000] bg-slate-900/95 backdrop-blur border border-slate-700 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-emerald-400 font-bold">WEBCAM LIVE</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-mono">
              {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
            </div>
          </div>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-slate-900 border-slate-800 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-950/60 text-emerald-400">
              <Camera size={20} />
            </div>
            <div>
              <div className="text-xs text-slate-400">Webcam Device</div>
              <div className="text-sm font-bold text-white">ANPR Scanner</div>
            </div>
          </div>
        </div>

        <div className="card bg-slate-900 border-slate-800 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-cyan-950/60 text-cyan-400">
              <MapPin size={20} />
            </div>
            <div>
              <div className="text-xs text-slate-400">GPS Coordinates</div>
              <div className="text-sm font-bold text-white font-mono">
                {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Detecting...'}
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-slate-900 border-slate-800 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-950/60 text-amber-400">
              <LocateFixed size={20} />
            </div>
            <div>
              <div className="text-xs text-slate-400">Accuracy</div>
              <div className="text-sm font-bold text-white">
                {location ? `~${Math.round(location.accuracy)}m` : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
