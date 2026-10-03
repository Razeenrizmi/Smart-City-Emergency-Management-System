/* Existing API wrappers intentionally translate Axios errors into user-facing errors. */
/* eslint-disable preserve-caught-error */
import apiClient from './appClient';

const apiError = (error, fallback) => {
  const data = error?.response?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (data?.message) return data.message;
  if (error?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (!error?.response) return 'Unable to reach the ASP.NET API. Confirm the backend is running.';
  return fallback;
};

export const getAllEmergencies = async () => {
  try {
    const response = await apiClient.get('/emergencies');
    return response.data;
  } catch (error) {
    throw new Error(apiError(error, 'Failed to load emergencies.'));
  }
};

export const getActiveEmergencies = async () => {
  try {
    const response = await apiClient.get('/emergencies/active');
    return response.data;
  } catch (error) {
    throw new Error(apiError(error, 'Failed to load active emergencies.'));
  }
};

export const getEmergencyById = async (sessionId) => {
  try {
    const response = await apiClient.get(`/emergencies/${sessionId}`);
    return response.data;
  } catch (error) {
    throw new Error(apiError(error, 'Failed to load emergency details.'));
  }
};

export const getAllRoutes = async () => {
  try {
    const response = await apiClient.get('/routes');
    return response.data;
  } catch (error) {
    throw new Error(apiError(error, 'Failed to load routes.'));
  }
};

export const getRouteById = async (routeId) => {
  try {
    const response = await apiClient.get(`/routes/${routeId}`);
    return response.data;
  } catch (error) {
    throw new Error(apiError(error, 'Failed to load route details.'));
  }
};

export const proposeSignals = async (sessionId) => {
  try {
    const response = await apiClient.post(`/emergencies/${sessionId}/propose-signals`);
    return response.data;
  } catch (error) {
    throw new Error(apiError(error, 'Failed to generate an AI proposal.'));
  }
};

export const getAiWorkflow = async (sessionId) => {
  try {
    const response = await apiClient.get(`/emergencies/${sessionId}/ai-workflow`);
    return response.data;
  } catch (error) {
    if (error?.response?.status === 404) return null;
    throw new Error(apiError(error, 'Failed to load the AI workflow.'));
  }
};

export const approveAiWorkflow = async (sessionId, payload) => {
  try {
    const response = await apiClient.post(`/emergencies/${sessionId}/ai-workflow/approve`, payload);
    return response.data;
  } catch (error) {
    throw new Error(apiError(error, 'Failed to approve the AI proposal.'));
  }
};

export const rejectAiWorkflow = async (sessionId, payload) => {
  try {
    const response = await apiClient.post(`/emergencies/${sessionId}/ai-workflow/reject`, payload);
    return response.data;
  } catch (error) {
    throw new Error(apiError(error, 'Failed to reject the AI proposal.'));
  }
};

export const activateGreenWave = async (sessionId) => {
  try {
    const response = await apiClient.post(`/emergencies/${sessionId}/activate-green-wave`);
    return response.data;
  } catch (error) {
    throw new Error(apiError(error, 'Failed to activate Green Wave.'));
  }
};

export const completeEmergency = async (sessionId) => {
  try {
    const response = await apiClient.post(`/emergencies/${sessionId}/complete`);
    return response.data;
  } catch (error) {
    throw new Error(apiError(error, 'Failed to complete the emergency session.'));
  }
};

export const cancelEmergency = async (sessionId) => {
  try {
    const response = await apiClient.post(`/emergencies/${sessionId}/cancel`);
    return response.data;
  } catch (error) {
    throw new Error(apiError(error, 'Failed to cancel the emergency session.'));
  }
};

export const getAiReport = async (sessionId) => {
  try {
    const response = await apiClient.get(`/emergencies/${sessionId}/ai-report`);
    return response.data;
  } catch (error) {
    throw new Error(apiError(error, 'Failed to load the AI decision report.'));
  }
};
