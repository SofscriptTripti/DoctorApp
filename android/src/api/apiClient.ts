import axios from 'axios';
import { getAccessToken, getRefreshToken, saveAuth, clearAuth, getUserInfo } from '../storage/authStorage';
import { refreshTokenAPI } from './authApi';
// import { Alert } from 'react-native'; // Optional: Use a navigation service or event emitter for global alerts if needed

const api = axios.create({
  baseURL: 'http://123.108.45.16:8650/CareScribeApiTest/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 and not a retry, and NOT the refresh endpoint itself
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('Auth/refresh')) {
      originalRequest._retry = true;

      try {
        const refreshToken = await getRefreshToken();
        const oldAccessToken = await getAccessToken();

        if (!refreshToken || !oldAccessToken) {
          throw new Error('No refresh token available');
        }

        // Call the refresh API
        const data = await refreshTokenAPI(oldAccessToken, refreshToken);

        if (data?.accessToken) {
          const userInfo = await getUserInfo();
          // Update storage
          await saveAuth(data.accessToken, data.refreshToken || refreshToken, userInfo);

          // Update header and retry
          api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
          originalRequest.headers['Authorization'] = `Bearer ${data.accessToken}`;

          return api(originalRequest);
        }
      } catch (refreshError) {
        console.log('Session expired, please login again.');
        await clearAuth();
        // Here you might want to navigate to Login screen, 
        // e.g. using a navigation reference or just letting the UI handle the missing token state
      }
    }

    return Promise.reject(error);
  }
);

export default api;
