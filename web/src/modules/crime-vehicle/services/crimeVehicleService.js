import apiClient from '../../../services/appClient';
import {
  INITIAL_CAMERAS,
  INITIAL_HOTLIST,
  INITIAL_PATROL_UNITS
} from '../data/mockCrimeVehicleData';

const STORAGE_KEYS = {
  HOTLIST: 'scems_crime_hotlist',
  LOGS: 'scems_crime_logs',
  CAMERAS: 'scems_crime_cameras',
  PATROLS: 'scems_crime_patrols'
};

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
  async getCameras() {
    try {
      const response = await apiClient.get('/crime-vehicle/cameras');
      return response.data?.data || INITIAL_CAMERAS;
    } catch (e) {
      console.warn('Backend unavailable, using fallback camera data');
      return INITIAL_CAMERAS;
    }
  },

  async getHotlist() {
    try {
      const response = await apiClient.get('/crime-vehicle/hotlist');
      return response.data?.data || [];
    } catch (e) {
      console.warn('Backend unavailable for hotlist');
      return null;
    }
  },

  async addHotlistVehicle(vehicleData) {
    try {
      const response = await apiClient.post('/crime-vehicle/hotlist', vehicleData);
      if (response.data?.success) return response.data.data;
    } catch (e) {
      console.warn('Backend add failed:', e.message);
    }
    const currentList = getStored(STORAGE_KEYS.HOTLIST, INITIAL_HOTLIST);
    const newVehicle = {
      id: `HV-${Date.now().toString().slice(-4)}`,
      status: 'WANTED',
      wantedSince: new Date().toISOString().replace('T', ' ').slice(0, 16),
      ...vehicleData
    };
    const updated = [newVehicle, ...currentList];
    setStored(STORAGE_KEYS.HOTLIST, updated);
    return newVehicle;
  },

  async deleteHotlistVehicle(vehicleId) {
    try {
      const response = await apiClient.delete(`/crime-vehicle/hotlist/${vehicleId}`);
      if (response.data?.success) return true;
    } catch (e) {
      console.warn('Backend delete failed:', e.message);
    }
    return false;
  },

  async updateHotlistVehicle(vehicleId, vehicleData) {
    try {
      const response = await apiClient.put(`/crime-vehicle/hotlist/${vehicleId}`, vehicleData);
      if (response.data?.success) return response.data.data;
    } catch (e) {
      console.warn('Backend update failed:', e.message);
    }
    return null;
  },

  async updateHotlistStatus(id, newStatus) {
    try {
      const response = await apiClient.put(`/crime-vehicle/hotlist/${id}/status`, { status: newStatus });
      if (response.data?.success) return response.data.data;
    } catch (e) {
      console.warn('Backend update failed:', e.message);
    }
    const currentList = getStored(STORAGE_KEYS.HOTLIST, INITIAL_HOTLIST);
    const updated = currentList.map(item => item.id === id ? { ...item, status: newStatus } : item);
    setStored(STORAGE_KEYS.HOTLIST, updated);
    return updated;
  },

  async getDetectionLogs() {
    try {
      const response = await apiClient.get('/crime-vehicle/logs');
      return response.data?.data || [];
    } catch (e) {
      console.warn('Backend unavailable for logs');
      return [];
    }
  },

  async getPatrolUnits() {
    try {
      const response = await apiClient.get('/crime-vehicle/patrols');
      return response.data?.data || INITIAL_PATROL_UNITS;
    } catch (e) {
      console.warn('Backend unavailable, using fallback patrol data');
      return INITIAL_PATROL_UNITS;
    }
  },

  async dispatchPatrol(unitId, logId) {
    try {
      const response = await apiClient.post('/crime-vehicle/dispatch', { unitId, logId });
      if (response.data?.success) return response.data.data;
    } catch (e) {
      console.warn('Backend dispatch failed:', e.message);
    }
    return { success: true, unitId, logId };
  },

  async scanFrame(imageBlobOrDataUrl, sessionId = '', nodeId = null) {
    try {
      const formData = new FormData();
      if (imageBlobOrDataUrl instanceof Blob) {
        formData.append('image', imageBlobOrDataUrl, 'cctv-frame.jpg');
      } else if (typeof imageBlobOrDataUrl === 'string') {
        const res = await fetch(imageBlobOrDataUrl);
        const blob = await res.blob();
        formData.append('image', blob, 'cctv-frame.jpg');
      } else {
        throw new Error('Invalid image format');
      }

      if (sessionId) {
        formData.append('sessionId', sessionId);
      }
      if (nodeId !== null && nodeId !== undefined && nodeId !== '') {
        formData.append('nodeId', String(nodeId));
      }

      const apiResponse = await apiClient.post('/crime-vehicle/scan', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (apiResponse.data?.success && apiResponse.data?.data) {
        const result = apiResponse.data.data;
        return {
          ...result,
          snapshot: typeof imageBlobOrDataUrl === 'string'
            ? imageBlobOrDataUrl
            : URL.createObjectURL(imageBlobOrDataUrl)
        };
      }

      return {
        detectionStatus: 'AI_SERVICE_UNAVAILABLE',
        vehicleInfo: 'AI service returned an invalid response.',
        snapshot: typeof imageBlobOrDataUrl === 'string'
          ? imageBlobOrDataUrl
          : URL.createObjectURL(imageBlobOrDataUrl),
        scannedAt: new Date().toISOString().replace('T', ' ').slice(0, 19)
      };
    } catch (e) {
      console.error('Backend scan API error:', e.message);
      return {
        detectionStatus: 'AI_SERVICE_UNAVAILABLE',
        vehicleInfo: `AI detection service unavailable: ${e.message}`,
        detectedPlate: 'ERROR',
        confidence: 0,
        plateConfidence: 0,
        vehicleConfidence: 0,
        isMatch: false,
        crimeStatus: 'ERROR',
        riskLevel: 'NONE',
        validationStatus: 'ERROR',
        agentStages: [],
        snapshot: typeof imageBlobOrDataUrl === 'string'
          ? imageBlobOrDataUrl
          : URL.createObjectURL(imageBlobOrDataUrl),
        scannedAt: new Date().toISOString().replace('T', ' ').slice(0, 19)
      };
    }
  },

  async endSession(sessionId) {
    try {
      const formData = new FormData();
      formData.append('sessionId', sessionId);
      await apiClient.post('/crime-vehicle/session/end', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    } catch (e) {
      console.warn('Failed to end session on backend:', e.message);
    }
  },

  async approveDetection(logId) {
    try {
      const response = await apiClient.put(`/crime-vehicle/logs/${logId}/approve`);
      if (response.data?.success) return response.data.data;
    } catch (e) {
      console.warn('Backend approve failed:', e.message);
    }
    return { success: true, logId, status: 'CONFIRMED_BY_OFFICER' };
  },

  async rejectDetection(logId) {
    try {
      const response = await apiClient.put(`/crime-vehicle/logs/${logId}/reject`);
      if (response.data?.success) return response.data.data;
    } catch (e) {
      console.warn('Backend reject failed:', e.message);
    }
    return { success: true, logId, status: 'REJECTED_BY_OFFICER' };
  },

  async getDetectionHistory(filters = {}) {
    try {
      const params = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') params[key] = value;
      });
      const response = await apiClient.get('/detection/history', { params });
      return response.data?.data || [];
    } catch (e) {
      console.warn('Detection history unavailable:', e.message);
      return [];
    }
  }
};
