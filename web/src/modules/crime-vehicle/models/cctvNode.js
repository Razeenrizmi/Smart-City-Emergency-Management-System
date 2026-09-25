export const CAMERA_TYPES = ['LAPTOP_WEBCAM', 'MOBILE_CAMERA', 'NETWORK_STREAM'];
export const STREAM_SOURCES = ['LOCAL_WEBCAM', 'PHONE_CAMERA', 'NETWORK_STREAM'];
export const NODE_STATUSES = ['OFFLINE', 'CONNECTING', 'ONLINE', 'ERROR', 'ANALYZING'];

export const normalizeNode = (raw) => ({
  id: raw?.id ?? raw?.nodeId ?? 0,
  nodeId: raw?.nodeId ?? raw?.id ?? 0,
  cameraName: raw?.cameraName || raw?.name || `CCTV Node ${raw?.nodeId ?? ''}`,
  location: raw?.location || raw?.zone || 'Unknown location',
  cameraType: raw?.cameraType || 'NETWORK_STREAM',
  status: NODE_STATUSES.includes(raw?.status) ? raw.status : 'OFFLINE',
  streamSource: raw?.streamSource || 'NETWORK_STREAM',
  streamUrl: raw?.streamUrl || '',
  createdAt: raw?.createdAt || '',
  lastSeenAt: raw?.lastSeenAt || 'Never'
});

export const phoneStreamUrl = (node) => {
  if (node?.streamUrl) return node.streamUrl;
  return import.meta.env.VITE_PHONE_CAMERA_URL || '';
};

export const isPhoneNode = (node) =>
  node?.streamSource === 'PHONE_CAMERA' || node?.cameraType === 'MOBILE_CAMERA';

export const isWebcamNode = (node) =>
  node?.streamSource === 'LOCAL_WEBCAM' || node?.cameraType === 'LAPTOP_WEBCAM';
