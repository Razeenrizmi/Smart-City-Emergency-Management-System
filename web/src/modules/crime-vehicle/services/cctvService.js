import apiClient from '../../../services/appClient';
import { FALLBACK_NODES } from '../data/mockCrimeVehicleData';
import { normalizeNode } from '../models/cctvNode';

export const DEFAULT_DETECTION_CONFIG = {
  targetAiFps: 5,
  frameIntervalMs: 200,
  confidenceThreshold: 0.6,
  iouThreshold: 0.45,
  trackingTimeoutSeconds: 3,
  confirmationFrames: 3,
  ocrConfidenceThreshold: 0.3,
  ocrFallbackMinConf: 0.55,
  plateVoteMin: 2,
  alertCooldownSeconds: 60
};

export const cctvService = {
  async getDetectionConfig() {
    try {
      const response = await apiClient.get('/detection/config');
      const data = response.data?.data;
      if (data && data.targetAiFps > 0) {
        return {
          ...DEFAULT_DETECTION_CONFIG,
          ...data,
          frameIntervalMs: data.targetAiFps > 0
            ? Math.round(1000 / data.targetAiFps)
            : data.frameIntervalMs
        };
      }
    } catch (e) {
      console.warn('Detection config unavailable, using defaults:', e.message);
    }
    return { ...DEFAULT_DETECTION_CONFIG };
  },

  async getNodes() {
    try {
      const response = await apiClient.get('/cctv/nodes');
      const rows = response.data?.data;
      if (Array.isArray(rows) && rows.length > 0) {
        return rows.map(normalizeNode);
      }
    } catch (e) {
      console.warn('Backend unavailable, using fallback CCTV node config');
    }
    return FALLBACK_NODES.map(normalizeNode);
  },

  async setNodeStatus(nodeId, status) {
    try {
      const response = await apiClient.put(`/cctv/nodes/${nodeId}/status`, { status });
      return response.data?.success ? response.data.data : null;
    } catch (e) {
      console.warn(`Failed to push node ${nodeId} status '${status}':`, e.message);
      return null;
    }
  },

  async startNodeSession(nodeId) {
    try {
      const response = await apiClient.post(`/cctv/nodes/${nodeId}/start`);
      if (response.data?.success && response.data?.data) {
        return response.data.data;
      }
    } catch (e) {
      console.warn(`Failed to start session for node ${nodeId}:`, e.message);
    }
    return null;
  },

  async stopNode(nodeId) {
    try {
      const response = await apiClient.post(`/cctv/nodes/${nodeId}/stop`);
      return response.data?.success ? response.data.data : null;
    } catch (e) {
      console.warn(`Failed to stop node ${nodeId}:`, e.message);
      return null;
    }
  },

  async getNodeSessions(nodeId) {
    try {
      const response = await apiClient.get(`/cctv/nodes/${nodeId}/sessions`);
      return response.data?.data || [];
    } catch (e) {
      return [];
    }
  },

  async getDetections(nodeId) {
    try {
      const response = await apiClient.get(`/detection/node/${nodeId}`);
      return response.data?.data || [];
    } catch (e) {
      return [];
    }
  },

  async getHistory(filters = {}) {
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
  },

  async getPlateObservations(plate) {
    if (!plate) return [];
    try {
      const response = await apiClient.get(`/detection/observations/${encodeURIComponent(plate)}`);
      return response.data?.data || [];
    } catch (e) {
      console.warn('Plate observations unavailable:', e.message);
      return [];
    }
  }
};
