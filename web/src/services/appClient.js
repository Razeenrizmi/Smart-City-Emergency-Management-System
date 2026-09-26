import axios from 'axios';
import { getSession, clearSession } from './auth';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5017/api',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = getSession()?.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Session expired / invalid — drop it and return to the login screen.
    if (error.response?.status === 401 && getSession()) {
      clearSession();
      window.location.reload();
    }
    return Promise.reject(error);
  },
);

export default apiClient;
