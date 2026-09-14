import axios from 'axios';

// Base URL for the backend API. Point this at the production API in
// client/.env (or the Vercel dashboard) using VITE_API_BASE_URL, e.g.:
//   VITE_API_BASE_URL=https://your-api.onrender.com/api
// In local development it falls back to '/api', which Vite proxies to the
// backend (see vite.config.js). The origin (no trailing /api) is used to
// resolve uploaded images hosted at /uploads/... on the backend.
export const API_ORIGIN = String(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/api\/?$/, '');

const api = axios.create({ baseURL: API_ORIGIN + '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('al_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('al_token');
      localStorage.removeItem('al_user');
    }
    return Promise.reject(err);
  }
);

export default api;