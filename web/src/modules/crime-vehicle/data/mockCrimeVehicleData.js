export const INITIAL_CAMERAS = [
  {
    id: 'CAM-101',
    name: 'Main St & 5th Ave Intersection',
    zone: 'Downtown Central',
    status: 'Alert',
    lat: 35,
    lng: 42,
    resolution: '4K HDR ANPR',
    fps: 60,
    scannedToday: 3840,
    lastPlate: 'WP CAD-7829',
    lastScanTime: '10s ago'
  },
  {
    id: 'CAM-102',
    name: 'West Highway Tollgate 4',
    zone: 'Western Corridor',
    status: 'Active',
    lat: 20,
    lng: 22,
    resolution: '1080p IR NightVision',
    fps: 30,
    scannedToday: 5120,
    lastPlate: 'CB-8821',
    lastScanTime: '2s ago'
  },
  {
    id: 'CAM-103',
    name: 'Metro City Bridge North Gate',
    zone: 'Northern Suburbs',
    status: 'Active',
    lat: 68,
    lng: 65,
    resolution: '4K Multi-Lane OCR',
    fps: 60,
    scannedToday: 4290,
    lastPlate: 'KAP-3091',
    lastScanTime: '5s ago'
  },
  {
    id: 'CAM-104',
    name: 'Financial District Plaza South',
    zone: 'Financial Quarter',
    status: 'Alert',
    lat: 48,
    lng: 78,
    resolution: '4K Ultra High Speed ANPR',
    fps: 120,
    scannedToday: 2980,
    lastPlate: 'SP BC-4410',
    lastScanTime: '1m ago'
  },
  {
    id: 'CAM-105',
    name: 'Airport Expressway Km 14',
    zone: 'Eastern Highway',
    status: 'Active',
    lat: 80,
    lng: 30,
    resolution: '1080p Long Range Lens',
    fps: 60,
    scannedToday: 6410,
    lastPlate: 'WP GZ-9901',
    lastScanTime: '12s ago'
  },
  {
    id: 'CAM-106',
    name: 'Harbor Commercial Docks Entrance',
    zone: 'Industrial Port',
    status: 'Maintenance',
    lat: 15,
    lng: 85,
    resolution: '1080p Thermal + ANPR',
    fps: 30,
    scannedToday: 810,
    lastPlate: 'TRK-5512',
    lastScanTime: '15m ago'
  }
];

export const INITIAL_HOTLIST = [
  {
    id: 'HV-1001',
    plateNumber: 'WP CAD-7829',
    makeModel: 'Toyota Land Cruiser V8',
    color: 'Obsidian Black',
    threatLevel: 'CRITICAL',
    incidentType: 'Armed Bank Robbery & Kidnapping',
    wantedSince: '2026-09-10 14:30',
    lastSeenCamera: 'CAM-101 (Main St & 5th Ave)',
    ownerName: 'Suspect Alias: "Viper"',
    status: 'WANTED',
    notes: 'Occupants armed with automatic rifles. Intercept only with SWAT / Tactical cover.',
    image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'HV-1002',
    plateNumber: 'SP BC-4410',
    makeModel: 'BMW 5 Series Sedan',
    color: 'Silver Metallic',
    threatLevel: 'HIGH',
    incidentType: 'Hit & Run Pedestrian Casualty',
    wantedSince: '2026-09-11 08:15',
    lastSeenCamera: 'CAM-104 (Financial Plaza)',
    ownerName: 'Registered: Marcus Vance',
    status: 'WANTED',
    notes: 'Front bumper heavily damaged on left side. Driver fleeing central district.',
    image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'HV-1003',
    plateNumber: 'WP GZ-9901',
    makeModel: 'Ford Transit Cargo Van',
    color: 'Matte White',
    threatLevel: 'HIGH',
    incidentType: 'Illegal Contraband Smuggling',
    wantedSince: '2026-09-09 21:00',
    lastSeenCamera: 'CAM-105 (Airport Exp Km 14)',
    ownerName: 'Apex Transport LLC (Fictitious)',
    status: 'SEARCHING',
    notes: 'Fake business logos on side panel. Suspected transport of stolen electronics.',
    image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'HV-1004',
    plateNumber: 'CP KY-1290',
    makeModel: 'Dodge Charger SRT',
    color: 'Crimson Red',
    threatLevel: 'MEDIUM',
    incidentType: 'Reckless Street Racing & Evading Arrest',
    wantedSince: '2026-09-11 01:45',
    lastSeenCamera: 'CAM-102 (West Tollgate)',
    ownerName: 'Registered: Julian Croft',
    status: 'INTERCEPTED',
    notes: 'Vehicle impounded at Sector 3 impound lot. Suspect detained.',
    image: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=600&q=80'
  }
];

export const INITIAL_DETECTION_LOGS = [
  {
    id: 'LOG-98401',
    timestamp: '2026-09-11 13:51:02',
    plateNumber: 'WP CAD-7829',
    cameraId: 'CAM-101',
    cameraName: 'Main St & 5th Ave Intersection',
    location: 'Downtown Central - Sector 1',
    confidence: 99.2,
    speed: '82 km/h',
    direction: 'Northbound',
    isHotlistMatch: true,
    threatLevel: 'CRITICAL',
    vehicleDetails: 'Toyota Land Cruiser (Obsidian Black)',
    status: 'ALERT_TRIGGERED',
    snapshot: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'LOG-98400',
    timestamp: '2026-09-11 13:48:30',
    plateNumber: 'SP BC-4410',
    cameraId: 'CAM-104',
    cameraName: 'Financial District Plaza South',
    location: 'Financial Quarter - Sector 4',
    confidence: 97.6,
    speed: '65 km/h',
    direction: 'Eastbound',
    isHotlistMatch: true,
    threatLevel: 'HIGH',
    vehicleDetails: 'BMW 5 Series (Silver Metallic)',
    status: 'DISPATCHED',
    snapshot: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'LOG-98399',
    timestamp: '2026-09-11 13:45:12',
    plateNumber: 'WP GZ-9901',
    cameraId: 'CAM-105',
    cameraName: 'Airport Expressway Km 14',
    location: 'Eastern Highway - Sector 7',
    confidence: 98.8,
    speed: '110 km/h',
    direction: 'Outbound',
    isHotlistMatch: true,
    threatLevel: 'HIGH',
    vehicleDetails: 'Ford Transit Van (Matte White)',
    status: 'ALERT_TRIGGERED',
    snapshot: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'LOG-98398',
    timestamp: '2026-09-11 13:42:00',
    plateNumber: 'CB-8821',
    cameraId: 'CAM-102',
    cameraName: 'West Highway Tollgate 4',
    location: 'Western Corridor - Gate 4',
    confidence: 99.8,
    speed: '45 km/h',
    direction: 'Inbound',
    isHotlistMatch: false,
    threatLevel: 'CLEAR',
    vehicleDetails: 'Honda Civic Sedan (Gray)',
    status: 'CLEARED',
    snapshot: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'LOG-98397',
    timestamp: '2026-09-11 13:40:18',
    plateNumber: 'KAP-3091',
    cameraId: 'CAM-103',
    cameraName: 'Metro City Bridge North Gate',
    location: 'Northern Suburbs - Bridge Gate',
    confidence: 96.4,
    speed: '58 km/h',
    direction: 'Southbound',
    isHotlistMatch: false,
    threatLevel: 'CLEAR',
    vehicleDetails: 'Nissan X-Trail SUV (Blue)',
    status: 'CLEARED',
    snapshot: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=600&q=80'
  }
];

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
    status: 'EN_ROUTE',
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

export const SAMPLE_SCAN_PRESETS = [
  {
    name: 'Sample 1: Suspect Land Cruiser (Wanted)',
    image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=600&q=80',
    detectedPlate: 'WP CAD-7829',
    confidence: 99.4,
    vehicleInfo: 'Obsidian Black Toyota Land Cruiser V8',
    box: { top: '42%', left: '32%', width: '36%', height: '24%' },
    isMatch: true
  },
  {
    name: 'Sample 2: Stolen BMW Sedan (Wanted)',
    image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=600&q=80',
    detectedPlate: 'SP BC-4410',
    confidence: 98.1,
    vehicleInfo: 'Silver Metallic BMW 5 Series',
    box: { top: '48%', left: '30%', width: '38%', height: '26%' },
    isMatch: true
  },
  {
    name: 'Sample 3: Normal Traffic Vehicle (Clear)',
    image: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=600&q=80',
    detectedPlate: 'CB-8821',
    confidence: 99.8,
    vehicleInfo: 'Gray Honda Civic Sedan',
    box: { top: '50%', left: '28%', width: '40%', height: '22%' },
    isMatch: false
  }
];
