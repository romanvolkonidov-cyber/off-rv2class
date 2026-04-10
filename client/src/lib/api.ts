import axios from 'axios';

// Define the official secure production base URL
export const PROD_URL = 'https://158.220.94.77.sslip.io';

const API_BASE = (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') 
  ? '' // Use relative path for proxy in production (proxied in next.config.js)
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000');

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('rv2class_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 responses (token expired)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('rv2class_token');
      localStorage.removeItem('rv2class_user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;
