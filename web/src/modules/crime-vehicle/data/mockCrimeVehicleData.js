export const INITIAL_CAMERAS = [
  {
    id: 'CAM-101',
    name: 'Main St & 5th Ave Intersection',
    zone: 'Downtown Central',
    status: 'Active',
    lat: 6.9271,
    lng: 79.8612,
    resolution: '4K HDR ANPR',
    fps: 60,
    scannedToday: 0,
    lastPlate: '',
    lastScanTime: 'Never'
  }
];

// Fallback CCTV node configuration used only when the backend is unreachable.
// Config only — every node starts OFFLINE; no fake streams or detections.
export const FALLBACK_NODES = [
  {
    id: 1,
    nodeId: 1,
    cameraName: 'Main Street CCTV',
    location: 'Main St & 5th Ave (University Simulated Node)',
    cameraType: 'LAPTOP_WEBCAM',
    status: 'OFFLINE',
    streamSource: 'LOCAL_WEBCAM',
    streamUrl: '',
    createdAt: '',
    lastSeenAt: 'Never'
  },
  {
    id: 2,
    nodeId: 2,
    cameraName: 'University Gate CCTV',
    location: 'University Main Gate (University Simulated Node)',
    cameraType: 'MOBILE_CAMERA',
    status: 'OFFLINE',
    streamSource: 'PHONE_CAMERA',
    streamUrl: import.meta.env.VITE_PHONE_CAMERA_URL || '',
    createdAt: '',
    lastSeenAt: 'Never'
  }
];

export const INITIAL_HOTLIST = [];

export const INITIAL_DETECTION_LOGS = [];

export const INITIAL_PATROL_UNITS = [
  {
    id: 'UNIT-402',
    callsign: 'Patrol Alpha 4',
    leadOfficer: 'Sgt. Miller & Off. Davis',
    sector: 'Downtown Central',
    status: 'AVAILABLE',
    vehicleType: 'High-Speed Interceptor Utility',
    distanceToAlert: '1.2 km',
    eta: '2 mins'
  },
  {
    id: 'UNIT-308',
    callsign: 'Tactical Bravo 2',
    leadOfficer: 'Capt. Reynolds (SWAT)',
    sector: 'Financial District',
    status: 'AVAILABLE',
    vehicleType: 'Armored Tactical Response Unit',
    distanceToAlert: '2.8 km',
    eta: '4 mins'
  },
  {
    id: 'UNIT-512',
    callsign: 'Highway Patrol Delta 9',
    leadOfficer: 'Off. Chen',
    sector: 'Western Highway Corridor',
    status: 'AVAILABLE',
    vehicleType: 'Dodge Pursuit Cruiser',
    distanceToAlert: '4.5 km',
    eta: '6 mins'
  },
  {
    id: 'UNIT-105',
    callsign: 'Air Surveillance Recon 1',
    leadOfficer: 'Pilot Vance',
    sector: 'City-Wide Aerial',
    status: 'ON_PATROL',
    vehicleType: 'Eurocopter Emergency Drone/Chopper',
    distanceToAlert: '0.8 km',
    eta: '1 min'
  }
];
