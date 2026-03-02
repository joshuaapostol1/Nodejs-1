import axios from 'axios';
import { authService } from './auth';

const API_URL = import.meta.env.VITE_API_URL || 'https://sharebooster.sbs';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  (config) => {
    const token = authService.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      authService.logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const apiService = {
  login: (username, password) =>
    api.post('/api/auth/login', { username, password }),

  register: (data) =>
    api.post('/api/auth/register', data),

  verifyOTP: (email, otp) =>
    api.post('/api/auth/verify-otp', { email, otp }),

  resendOTP: (email) =>
    api.post('/api/auth/resend-otp', { email }),

  getProfile: () =>
    api.get('/api/auth/profile'),

  updateProfile: (data) =>
    api.put('/api/profile/update', data),

  changePassword: (data) =>
    api.post('/api/profile/change-password', data),

  submitShare: (data) =>
    api.post('/api/submit', data),

  stopShare: () =>
    api.post('/stop-share'),

  getShareStatus: () =>
    api.get('/share-status'),

  getShareLogs: () =>
    api.get('/api/share-logs'),

  clearShareLogs: () =>
    api.delete('/api/share-logs'),

  requestPremium: (plan) =>
    api.post('/api/premium/request', { plan }),

  saveCookie: (cookieData) =>
    api.post('/api/cookies/save', { cookieData }),

  getCookie: () =>
    api.get('/api/cookies/get'),

  deleteCookie: () =>
    api.delete('/api/cookies/delete')
};

export default api;
