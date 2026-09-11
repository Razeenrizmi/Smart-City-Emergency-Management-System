import apiClient from '../../../services/appClient';
import {
  INITIAL_CAMERAS,
  INITIAL_HOTLIST,
  INITIAL_DETECTION_LOGS,
  INITIAL_PATROL_UNITS,
  SAMPLE_SCAN_PRESETS
} from '../data/mockCrimeVehicleData';

// Local storage keys for state persistence in browser demo
const STORAGE_KEYS = {
  HOTLIST: 'scems_crime_hotlist',
  LOGS: 'scems_crime_logs',
  CAMERAS: 'scems_crime_cameras',
  PATROLS: 'scems_crime_patrols'
};

// Check if backend API integration is explicitly requested
const USE_BACKEND_API = import.meta.env.VITE_ENABLE_BACKEND_API === 'true';

const getStored = (key, fallback) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch (e) {
    return fallback;
  }
};

const setStored = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Storage save error:', e);
  }
};

export const crimeVehicleService = {
  // Fetch cameras
  async getCameras() {
    if (USE_BACKEND_API) {
      try {
        const response = await apiClient.get('/crime-vehicle/cameras');
        return response.data;
      } catch (e) {
        console.warn('Backend unavailable, falling back to local storage');
      }
    }
    return getStored(STORAGE_KEYS.CAMERAS, INITIAL_CAMERAS);
  },

  // Fetch wanted hotlist
  async getHotlist() {
    if (USE_BACKEND_API) {
      try {
        const response = await apiClient.get('/crime-vehicle/hotlist');
        return response.data;
      } catch (e) {
        console.warn('Backend unavailable, falling back to local storage');
      }
    }
    return getStored(STORAGE_KEYS.HOTLIST, INITIAL_HOTLIST);
  },

  // Add new wanted vehicle to hotlist
  async addHotlistVehicle(vehicleData) {
    const currentList = getStored(STORAGE_KEYS.HOTLIST, INITIAL_HOTLIST);
    const newVehicle = {
      id: `HV-${Date.now().toString().slice(-4)}`,
      status: 'WANTED',
      wantedSince: new Date().toISOString().replace('T', ' ').slice(0, 16),
      image: vehicleData.image || 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80',
      ...vehicleData
    };

    if (USE_BACKEND_API) {
      try {
        const response = await apiClient.post('/crime-vehicle/hotlist', newVehicle);
        return response.data;
      } catch (e) {
        console.warn('Backend unavailable, saving locally');
      }
    }

    const updated = [newVehicle, ...currentList];
    setStored(STORAGE_KEYS.HOTLIST, updated);
    return newVehicle;
  },

  // Update status or remove from hotlist
  async updateHotlistStatus(id, newStatus) {
    const currentList = getStored(STORAGE_KEYS.HOTLIST, INITIAL_HOTLIST);
    const updated = currentList.map(item => item.id === id ? { ...item, status: newStatus } : item);
    setStored(STORAGE_KEYS.HOTLIST, updated);
    return updated;
  },

  // Fetch detection logs
  async getDetectionLogs() {
    if (USE_BACKEND_API) {
      try {
        const response = await apiClient.get('/crime-vehicle/logs');
        return response.data;
      } catch (e) {
        console.warn('Backend unavailable, falling back to local storage');
      }
    }
    return getStored(STORAGE_KEYS.LOGS, INITIAL_DETECTION_LOGS);
  },

  // Fetch available patrol units
  async getPatrolUnits() {
    if (USE_BACKEND_API) {
      try {
        const response = await apiClient.get('/crime-vehicle/patrols');
        return response.data;
      } catch (e) {
        console.warn('Backend unavailable, falling back to local storage');
      }
    }
    return getStored(STORAGE_KEYS.PATROLS, INITIAL_PATROL_UNITS);
  },

  // Dispatch Patrol Unit
  async dispatchPatrol(unitId, logId) {
    const patrols = getStored(STORAGE_KEYS.PATROLS, INITIAL_PATROL_UNITS);
    const updatedPatrols = patrols.map(u => u.id === unitId ? { ...u, status: 'EN_ROUTE', eta: '3 mins' } : u);
    setStored(STORAGE_KEYS.PATROLS, updatedPatrols);

    const logs = getStored(STORAGE_KEYS.LOGS, INITIAL_DETECTION_LOGS);
    const updatedLogs = logs.map(l => l.id === logId ? { ...l, status: 'DISPATCHED' } : l);
    setStored(STORAGE_KEYS.LOGS, updatedLogs);

    return { success: true, unitId, logId };
  },

  // ANPR Image analysis tool simulation
  async analyzeVehicleImage(imageUrlOrPreset, customPlateNumber = '') {
    // Artificial delay for futuristic scanning loading effect
    await new Promise(resolve => setTimeout(resolve, 1200));

    const hotlist = getStored(STORAGE_KEYS.HOTLIST, INITIAL_HOTLIST);

    let preset = SAMPLE_SCAN_PRESETS.find(p => p.image === imageUrlOrPreset);

    let plate = customPlateNumber || (preset ? preset.detectedPlate : 'WP CAD-7829');
    let confidence = preset ? preset.confidence : (94 + Math.random() * 5.5).toFixed(1);
    let vehicleInfo = preset ? preset.vehicleInfo : 'Identified Vehicle (SUV Class)';

    // Check match against hotlist
    const matchedVehicle = hotlist.find(h =>
      h.plateNumber.replace(/\s+/g, '').toUpperCase() === plate.replace(/\s+/g, '').toUpperCase()
    );

    const scanResult = {
      detectedPlate: plate,
      confidence: parseFloat(confidence),
      vehicleInfo,
      isMatch: !!matchedVehicle,
      matchedVehicle: matchedVehicle || null,
      box: preset ? preset.box : { top: '45%', left: '32%', width: '36%', height: '24%' },
      scannedAt: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };

    // If match found, generate a log entry automatically
    if (matchedVehicle) {
      const logs = getStored(STORAGE_KEYS.LOGS, INITIAL_DETECTION_LOGS);
      const newLog = {
        id: `LOG-${Math.floor(10000 + Math.random() * 90000)}`,
        timestamp: scanResult.scannedAt,
        plateNumber: plate,
        cameraId: 'ANPR-UPLOAD-01',
        cameraName: 'Manual Scanner Upload / Tactical Field Recon',
        location: 'Field Upload Node',
        confidence: scanResult.confidence,
        speed: 'Scanned Image',
        direction: 'Stationary Scan',
        isHotlistMatch: true,
        threatLevel: matchedVehicle.threatLevel,
        vehicleDetails: matchedVehicle.makeModel + ` (${matchedVehicle.color})`,
        status: 'ALERT_TRIGGERED',
        snapshot: imageUrlOrPreset
      };
      setStored(STORAGE_KEYS.LOGS, [newLog, ...logs]);
    }

    return scanResult;
  }
};
