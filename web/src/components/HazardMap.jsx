import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { AlertTriangle, ExternalLink, Navigation, Layers, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix default Leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Colombo Dematagoda -> Dehiwala Commuter Corridor Coordinates
const DEMATAGODA_DEHIWALA_ROUTE = [
  [6.9322, 79.8821], // Dematagoda Junction
  [6.9250, 79.8805], // Baseline Rd
  [6.9147, 79.8778], // Borella Junction
  [6.9075, 79.8780], // Castle St Flyover
  [6.8988, 79.8783], // Narahenpita / Elvitigala Mawatha
  [6.8835, 79.8762], // Kirulapone / High Level Rd
  [6.8745, 79.8660], // Pamankada Junction
  [6.8680, 79.8610], // Wellawatte / Galle Rd
  [6.8511, 79.8653], // Dehiwala Junction
];

const TILE_PROVIDERS = {
  dark: {
    name: 'Dark Mode',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO',
  },
  satellite: {
    name: 'Google / Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri & Earthstar Geographics',
  },
  streets: {
    name: 'Street View',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
  },
};

const BoundsAdjuster = ({ hazards }) => {
  const map = useMap();
  useEffect(() => {
    if (hazards && hazards.length > 0) {
      const bounds = L.latLngBounds(
        hazards.map((h) => [h.latitude, h.longitude])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [hazards, map]);
  return null;
};

const getSeverityIcon = (severityScore, isAiVerified) => {
  let color = '#4299E1';
  let scale = 1;

  if (severityScore >= 5) { color = '#E53E3E'; scale = 1.3; }
  else if (severityScore >= 3) { color = '#ED8936'; scale = 1.15; }
  else if (severityScore >= 2) { color = '#ECC94B'; scale = 1.05; }

  // AI-verified markers get a dashed purple ring
  const aiRing = isAiVerified
    ? `<circle cx="${12 * scale}" cy="${11 * scale}" r="${13 * scale}" fill="none" stroke="#764BA2" stroke-width="1.8" stroke-dasharray="4 2" opacity="0.85"/>`
    : '';

  const size = 24 * scale;
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      ${aiRing}
      <path d="M${12 * scale} ${2 * scale}L${2 * scale} ${22 * scale}h${20 * scale}Z"
        fill="${color}" stroke="#1A202C" stroke-width="2" stroke-linejoin="round"/>
      <line x1="${12 * scale}" y1="${9 * scale}" x2="${12 * scale}" y2="${13 * scale}" stroke="#1A202C" stroke-width="2"/>
      <circle cx="${12 * scale}" cy="${17 * scale}" r="1" fill="#1A202C"/>
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    className: 'custom-leaflet-icon',
    iconSize: [size, size],
    iconAnchor: [12 * scale, size],
    popupAnchor: [0, -size],
  });
};

const HazardMap = ({ hazards = [] }) => {
  const defaultCenter = [6.8916, 79.8737]; // Centered on Dematagoda-Dehiwala corridor
  const [activeTile, setActiveTile] = useState('dark');
  const [showCorridor, setShowCorridor] = useState(true);

  return (
    <div className="map-container-wrapper" style={{ height: '100%', width: '100%', borderRadius: '16px', overflow: 'hidden', border: '1px solid #30363D', position: 'relative' }}>
      
      {/* Top Map Toolbar: Layer Switcher + Corridor Route + Google Maps Link */}
      <div style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(22, 27, 34, 0.92)',
        backdropFilter: 'blur(8px)',
        border: '1px solid #30363D',
        borderRadius: '12px',
        padding: '6px 10px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}>
        {/* Layer Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Layers size={14} color="#8B949E" />
          <select
            value={activeTile}
            onChange={(e) => setActiveTile(e.target.value)}
            style={{
              background: '#0D1117',
              color: '#C9D1D9',
              border: '1px solid #30363D',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="dark">Dark Carto</option>
            <option value="satellite">Google Satellite</option>
            <option value="streets">Open Streets</option>
          </select>
        </div>

        {/* Corridor Toggle */}
        <button
          onClick={() => setShowCorridor(!showCorridor)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: showCorridor ? 'rgba(66, 153, 225, 0.2)' : '#0D1117',
            border: showCorridor ? '1px solid #4299E1' : '1px solid #30363D',
            color: showCorridor ? '#63B3ED' : '#8B949E',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          title="Toggle Dematagoda ➔ Dehiwala Commuter Corridor"
        >
          <Navigation size={13} />
          <span>Dematagoda ➔ Dehiwala</span>
        </button>

        {/* Open Corridor in Google Maps */}
        <a
          href="https://www.google.com/maps/dir/?api=1&origin=Dematagoda,Colombo&destination=Dehiwala,Colombo&travelmode=driving"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: '#1A73E8',
            color: '#fff',
            textDecoration: 'none',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 700,
            boxShadow: '0 2px 6px rgba(26,115,232,0.3)',
          }}
        >
          <span>Google Maps</span>
          <ExternalLink size={12} />
        </a>
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={12}
        maxZoom={22}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution={TILE_PROVIDERS[activeTile].attribution}
          url={TILE_PROVIDERS[activeTile].url}
          maxZoom={22}
          maxNativeZoom={activeTile === 'satellite' ? 18 : 19}
        />

        <BoundsAdjuster hazards={hazards} />

        {/* Dematagoda to Dehiwala Commuter Route Polyline */}
        {showCorridor && (
          <>
            {/* Glowing outer polyline */}
            <Polyline
              positions={DEMATAGODA_DEHIWALA_ROUTE}
              pathOptions={{
                color: '#4285F4',
                weight: 8,
                opacity: 0.35,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            {/* Main Google Maps navigation blue route */}
            <Polyline
              positions={DEMATAGODA_DEHIWALA_ROUTE}
              pathOptions={{
                color: '#1A73E8',
                weight: 4.5,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            {/* Start point: Dematagoda */}
            <CircleMarker
              center={DEMATAGODA_DEHIWALA_ROUTE[0]}
              radius={7}
              pathOptions={{ color: '#0F9D58', fillColor: '#0F9D58', fillOpacity: 1, weight: 3 }}
            >
              <Popup className="custom-popup">
                <div style={{ color: '#fff', fontFamily: 'Inter, sans-serif' }}>
                  <strong>🚩 Dematagoda Junction</strong>
                  <div style={{ fontSize: '11px', color: '#A0AEC0' }}>Route Origin (Baseline Rd)</div>
                </div>
              </Popup>
            </CircleMarker>
            {/* End point: Dehiwala */}
            <CircleMarker
              center={DEMATAGODA_DEHIWALA_ROUTE[DEMATAGODA_DEHIWALA_ROUTE.length - 1]}
              radius={7}
              pathOptions={{ color: '#EA4335', fillColor: '#EA4335', fillOpacity: 1, weight: 3 }}
            >
              <Popup className="custom-popup">
                <div style={{ color: '#fff', fontFamily: 'Inter, sans-serif' }}>
                  <strong>🏁 Dehiwala Junction</strong>
                  <div style={{ fontSize: '11px', color: '#A0AEC0' }}>Route Destination (Galle Rd)</div>
                </div>
              </Popup>
            </CircleMarker>
          </>
        )}

        {/* Hazard Markers */}
        {hazards.map((hazard) => (
          <Marker
            key={hazard.hazardId}
            position={[hazard.latitude, hazard.longitude]}
            icon={getSeverityIcon(hazard.severityScore, hazard.isVerified)}
          >
            <Popup className="custom-popup">
              <div style={{ minWidth: '230px', fontFamily: 'Inter, sans-serif' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', borderBottom: '1px solid #2D3748', paddingBottom: '8px' }}>
                  <AlertTriangle size={18} color={hazard.severityScore >= 5 ? '#E53E3E' : hazard.severityScore >= 3 ? '#ED8936' : '#4299E1'} />
                  <strong style={{ fontSize: '15px', color: '#fff' }}>
                    {hazard.aiDetectedCategory || hazard.hazardType || 'Road Hazard'}
                  </strong>
                </div>

                {/* 🤖 AI Verification Badge */}
                {hazard.isVerified && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'linear-gradient(135deg, rgba(102,126,234,0.2), rgba(118,75,162,0.15))',
                    border: '1px solid rgba(118,75,162,0.4)',
                    borderRadius: '8px',
                    padding: '5px 8px',
                    marginBottom: '10px',
                    fontSize: '12px',
                  }}>
                    <span>🤖</span>
                    <span style={{ color: '#A78BFA', fontWeight: 700 }}>AI Verified</span>
                    {hazard.aiDetectedCategory && (
                      <span style={{ color: '#8B949E' }}>· {hazard.aiDetectedCategory}</span>
                    )}
                    {hazard.aiConfidenceScore > 0 && (
                      <span style={{
                        marginLeft: 'auto', color: '#48BB78', fontWeight: 700, fontSize: '11px',
                        background: 'rgba(72,187,120,0.15)', padding: '2px 6px', borderRadius: '10px',
                      }}>
                        {(hazard.aiConfidenceScore * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                )}

                {/* AI Analysis Summary */}
                {hazard.aiAnalysisSummary && (
                  <div style={{
                    background: 'rgba(255,255,255,0.04)', borderRadius: '6px',
                    padding: '6px 8px', marginBottom: '8px',
                    fontSize: '11px', color: '#A0AEC0', lineHeight: '1.5',
                  }}>
                    {hazard.aiAnalysisSummary}
                  </div>
                )}

                {/* Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', color: '#A0AEC0', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Severity:</span>
                    <strong style={{ color: '#fff' }}>{hazard.severityScore}/5</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Z-Spike:</span>
                    <strong style={{ color: '#fff' }}>{hazard.accelerometerZSpike ? hazard.accelerometerZSpike.toFixed(2) : '0.00'} m/s²</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Coordinates:</span>
                    <span style={{ color: '#E2E8F0', fontSize: '12px' }}>
                      {hazard.latitude.toFixed(4)}, {hazard.longitude.toFixed(4)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Status:</span>
                    <strong style={{ color: hazard.isVerified ? '#48BB78' : '#ECC94B' }}>
                      {hazard.isVerified ? '✅ Verified' : '⏳ Pending'}
                    </strong>
                  </div>
                  <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #2D3748', fontSize: '11px', color: '#718096' }}>
                    {new Date(hazard.createdAt).toLocaleString()}
                  </div>

                  {/* Open in Google Maps Link */}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${hazard.latitude},${hazard.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      marginTop: '8px',
                      padding: '6px 10px',
                      background: 'rgba(26, 115, 232, 0.15)',
                      border: '1px solid rgba(26, 115, 232, 0.4)',
                      borderRadius: '8px',
                      color: '#63B3ED',
                      textDecoration: 'none',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    <MapPin size={13} />
                    <span>View Spot in Google Maps</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default HazardMap;
