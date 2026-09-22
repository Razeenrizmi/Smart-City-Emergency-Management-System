import apiClient from './appClient';

// Get all emergency sessions
export const getAllEmergencies = async () => {
  try {
    const response = await apiClient.get('/emergencies');
    return response.data;
  } catch (error) {
    console.error('Error fetching all emergencies:', error);
    throw error;
  }
};

// Get active emergency sessions
export const getActiveEmergencies = async () => {
  try {
    const response = await apiClient.get('/emergencies/active');
    return response.data;
  } catch (error) {
    console.error('Error fetching active emergencies:', error);
    throw error;
  }
};

// Get emergency session by ID
export const getEmergencyById = async (sessionId) => {
  try {
    const response = await apiClient.get(`/emergencies/${sessionId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching emergency session:', error);
    throw error;
  }
};

// Get all routes
export const getAllRoutes = async () => {
  try {
    const response = await apiClient.get('/routes');
    return response.data;
  } catch (error) {
    console.error('Error fetching routes:', error);
    throw error;
  }
};

// Get route by ID
export const getRouteById = async (routeId) => {
  try {
    const response = await apiClient.get(`/routes/${routeId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching route:', error);
    throw error;
  }
};
