import axios from 'axios';
import { getAccessToken, getRefreshToken, saveAuth, clearAuth, getUserInfo } from '../storage/authStorage';
import { refreshTokenAPI } from './authApi';
// import { Alert } from 'react-native'; // Optional: Use a navigation service or event emitter for global alerts if needed

const api = axios.create({
  // baseURL: 'http://123.108.45.16:8650/CareScribeApiTest/api/v1',
  baseURL: 'https://cw.sofscript.com:8654/CareScribeApiTest/api/v1',  
  // baseURL: 'http://localhost/CareScribeApiTest/api/v1/',

  headers: {

    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  // Use the token already set in headers (like in a retry) if available
  if (config.headers.Authorization) {
    console.log(`[API REQUEST] Using existing Auth header for ${config.url}`);
    return config;
  }

  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log(`[API REQUEST] Set Auth header for ${config.url}`);
  } else {
    console.warn(`[API REQUEST] No token found for ${config.url}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response) {
      console.error(`❌ [API ERROR] ${error.config?.method?.toUpperCase()} ${error.config?.url} | Status: ${error.response.status} | Data:`, error.response.data);
    }

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

          // Update header for the retry
          // Using axios.defaults or api.defaults might not affect the current originalRequest
          // We must update originalRequest.headers directly.
          // Axios v1.x uses an AxiosHeaders object, but setting it as a property also works.
          // To be safe, we use the property name that matches our interceptor.
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;

          // Also update the instance defaults for future requests
          api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;

          console.log('RETRYING REQUEST with new token... 🔄', {
            url: originalRequest.url,
            newToken: data.accessToken.substring(0, 10) + '...',
            headers: originalRequest.headers.Authorization
          });
          return api(originalRequest);
        }
      } catch (refreshError) {
        console.log('Session expired or refresh failed, please login again.');
        await clearAuth();
        // UI should handle the empty auth state by redirecting to login
      }
    }

    if (error.response) {
      console.log('❌ [API ERROR] Response:', {
        url: error.config?.url,
        status: error.response.status,
        data: error.response.data,
      });
    } else {
      console.log('❌ [API ERROR] No Response:', error.message);
    }

    return Promise.reject(error);
  }
);

export default api;
