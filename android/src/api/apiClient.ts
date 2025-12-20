import axios from 'axios';
import { getAccessToken } from '../storage/authStorage';

const api = axios.create({
    baseURL: 'http://123.108.45.16:8650/CareScribeApi/api/v1',
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

export default api;
