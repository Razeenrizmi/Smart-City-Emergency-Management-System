import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { AlertTriangle, ExternalLink, Navigation, Layers, MapPin, Maximize2, Wrench } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { statusMeta } from '../workflow';

// Fix Leaflet's missing default icon paths safely without mutating prototype globally
const defaultIcon = L.icon({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = defaultIcon;

// Sri Lanka Island Geographic Boundaries
const SRI_LANKA_CENTER = [7.8731, 80.7718]; // Geographical Center of Sri Lanka
const SRI_LANKA_BOUNDS = [
  [5.8, 79.5],  // Southwest corner (South of Galle / Matara)
  [9.9, 82.0]   // Northeast corner (North of Jaffna / Trincomalee)
];

// Colombo Commuter Route Coordinates (Dematagoda -> Dehiwala)
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
  osm_standard: {
    name: 'OpenStreetMap (Sri Lanka)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    attribution: '&copy; OpenStreetMap contributors',
  },
  google_streets: {
    name: 'Google Maps (Streets)',
    url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google Maps',
  },
  google_hybrid: {
    name: 'Google Satellite',
    url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google Maps Imagery',
  },
  carto_dark: {
    name: 'Carto Dark Mode',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  }
};

const BoundsAdjuster = ({ hazards, triggerFit }) => {
  const map = useMap();
  const hasAdjustedRef = useRef(false);

  useEffect(() => {
    // Invalidate size after render to fix grey tile glitches
    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [map]);

  useEffect(() => {
    if (!hasAdjustedRef.current && hazards && hazards.length > 0) {
      const validHazards = hazards.filter(h => h.latitude && h.longitude && (h.latitude !== 0 || h.longitude !== 0));
      if (validHazards.length > 0) {
        hasAdjustedRef.current = true;
        const bounds = L.latLngBounds(validHazards.map((h) => [h.latitude, h.longitude]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [hazards, map]);

  useEffect(() => {
    if (triggerFit) {
      if (hazards && hazards.length > 0) {
        const validHazards = hazards.filter(h => h.latitude && h.longitude && (h.latitude !== 0 || h.longitude !== 0));
        if (validHazards.length > 0) {
          const bounds = L.latLngBounds(validHazards.map((h) => [h.latitude, h.longitude]));
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
          return;
        }
      }
      // Reset back to whole Sri Lanka view if no hazards are present
      map.setView(SRI_LANKA_CENTER, 8);
    }
  }, [triggerFit, hazards, map]);

  return null;
};

const getSeverityIcon = (severityScore = 1, isAiVerified = false) => {
  let color = '#4299E1';
  let scale = 1;

  if (severityScore >= 5) { color = '#E53E3E'; scale = 1.3; }
  else if (severityScore >= 3) { color = '#ED8936'; scale = 1.15; }
  else if (severityScore >= 2) { color = '#ECC94B'; scale = 1.05; }

  const size = Math.round(24 * scale);
  const aiRing = isAiVerified
    ? `<circle cx="${size / 2}" cy="${size / 2 - 1}" r="${(size / 2) - 1}" fill="none" stroke="#764BA2" stroke-width="2" stroke-dasharray="3 2" opacity="0.9"/>`
    : '';

  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      ${aiRing}
      <path d="M${size / 2} 2 L2 ${size - 2} h${size - 4} Z" fill="${color}" stroke="#1A202C" stroke-width="1.8" stroke-linejoin="round"/>
      <line x1="${size / 2}" y1="${size * 0.38}" x2="${size / 2}" y2="${size * 0.58}" stroke="#1A202C" stroke-width="2"/>
      <circle cx="${size / 2}" cy="${size * 0.72}" r="1.2" fill="#1A202C"/>
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    className: 'custom-leaflet-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
};

const HazardMap = ({ hazards = [], onAssign }) => {
  const [activeTile, setActiveTile] = useState('osm_standard');
  const [showCorridor, setShowCorridor] = useState(true);
  const [fitTrigger, setFitTrigger] = useState(0);

  return (
    <div
      className="map-container-wrapper"
      style={{
        height: '100%',
        minHeight: '500px',
        width: '100%',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid #30363D',
        position: 'relative'
      }}
    >
      {/* Top Map Toolbar */}
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
            <option value="osm_standard">OpenStreetMap (Sri Lanka)</option>
            <option value="google_streets">Google Maps (Streets)</option>
            <option value="google_hybrid">Google Satellite</option>
            <option value="carto_dark">Carto Dark Mode</option>
          </select>
        </div>

        {/* Fit Sri Lanka / Hazards Button */}
        <button
          type="button"
          onClick={() => setFitTrigger((prev) => prev + 1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: '#0D1117',
            border: '1px solid #30363D',
            color: '#C9D1D9',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Reset View to Sri Lanka"
        >
          <Maximize2 size={13} />
          <span>Reset View</span>
        </button>

        {/* Corridor Toggle */}
        <button
          type="button"
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
          }}
          title="Toggle Commuter Route Corridor"
        >
          <Navigation size={13} />
          <span>Colombo Route</span>
        </button>
      </div>

      <MapContainer
        center={SRI_LANKA_CENTER}
        zoom={8}
        minZoom={7}
        maxZoom={19}
        maxBounds={SRI_LANKA_BOUNDS}
        maxBoundsViscosity={0.8}
        style={{ height: '100%', width: '100%', minHeight: '500px' }}
        zoomControl={true}
      >
        <TileLayer
          key={activeTile}
          attribution={TILE_PROVIDERS[activeTile].attribution}
          url={TILE_PROVIDERS[activeTile].url}
          subdomains={TILE_PROVIDERS[activeTile].subdomains}
          maxZoom={19}
        />

        <BoundsAdjuster hazards={hazards} triggerFit={fitTrigger} />

        {/* Colombo Commuter Route */}
        {showCorridor && (
          <>
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
            <CircleMarker
              center={DEMATAGODA_DEHIWALA_ROUTE[0]}
              radius={6}
              pathOptions={{ color: '#0F9D58', fillColor: '#0F9D58', fillOpacity: 1, weight: 2 }}
            >
              <Popup>
                <div style={{ color: '#1A202C', fontFamily: 'Inter, sans-serif' }}>
                  <strong>🚩 Dematagoda Junction</strong>
                </div>
              </Popup>
            </CircleMarker>
            <CircleMarker
              center={DEMATAGODA_DEHIWALA_ROUTE[DEMATAGODA_DEHIWALA_ROUTE.length - 1]}
              radius={6}
              pathOptions={{ color: '#EA4335', fillColor: '#EA4335', fillOpacity: 1, weight: 2 }}
            >
              <Popup>
                <div style={{ color: '#1A202C', fontFamily: 'Inter, sans-serif' }}>
                  <strong>🏁 Dehiwala Junction</strong>
                </div>
              </Popup>
            </CircleMarker>
          </>
        )}

        {/* Hazard Markers across Sri Lanka */}
        {hazards.filter(h => h && h.latitude && h.longitude).map((hazard) => (
          <Marker
            key={hazard.hazardId || hazard.id || `${hazard.latitude}-${hazard.longitude}`}
            position={[hazard.latitude, hazard.longitude]}
            icon={getSeverityIcon(hazard.severityScore, hazard.isVerified)}
          >
            <Popup>
              <div style={{ minWidth: '200px', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', borderBottom: '1px solid #E2E8F0', paddingBottom: '4px' }}>
                  <AlertTriangle size={15} color={hazard.severityScore >= 5 ? '#E53E3E' : hazard.severityScore >= 3 ? '#ED8936' : '#4299E1'} />
                  <strong style={{ fontSize: '13px', color: '#1A202C' }}>
                    {hazard.aiDetectedCategory || hazard.hazardType || 'Road Hazard'}
                  </strong>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', color: '#4A5568', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Severity:</span>
                    <strong style={{ color: '#1A202C' }}>{hazard.severityScore || 1}/5</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Coordinates:</span>
                    <span style={{ color: '#2D3748', fontSize: '11px' }}>
                      {Number(hazard.latitude).toFixed(4)}, {Number(hazard.longitude).toFixed(4)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Status:</span>
                    <strong style={{ color: statusMeta(hazard.approvalStatus).color }}>
                      {statusMeta(hazard.approvalStatus).label}
                    </strong>
                  </div>

                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${hazard.latitude},${hazard.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                      marginTop: '6px', padding: '4px 8px', background: '#EBF8FF',
                      border: '1px solid #BEE3F8', borderRadius: '6px', color: '#2B6CB0',
                      textDecoration: 'none', fontSize: '11px', fontWeight: 600,
                    }}
                  >
                    <MapPin size={11} />
                    <span>View in Google Maps</span>
                    <ExternalLink size={10} />
                  </a>

                  {hazard.approvalStatus === 'APPROVED' ? (
                    <button
                      type="button"
                      onClick={() => onAssign?.(hazard)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                        marginTop: '6px', padding: '6px 8px', background: '#667EEA', border: 'none',
                        borderRadius: '6px', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      <Wrench size={11} />
                      Assign Worker
                    </button>
                  ) : (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                      marginTop: '6px', padding: '5px 8px', background: '#FEFCBF', border: '1px solid #F6E05E',
                      borderRadius: '6px', color: '#975A16', fontSize: '10px', fontWeight: 600,
                    }}>
                      Awaiting officer approval
                    </div>
                  )}
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