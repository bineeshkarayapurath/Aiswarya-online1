import axios from 'axios';

// Base URL for the backend API. Point this at the production API in
// client/.env (or the Vercel dashboard) using VITE_API_BASE_URL, e.g.:
//   VITE_API_BASE_URL=https://your-api.onrender.com/api
// In local development it falls back to '/api', which Vite proxies to the
// backend (see vite.config.js). The origin (no trailing /api) is used to
// resolve uploaded images hosted at /uploads/... on the backend.
export const API_ORIGIN = String(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/api\/?$/, '');

// Resolve any stored media path into a URL the browser can load. Photos
// hosted under /uploads/ are prefixed with the API origin; absolute
// http(s) / protocol-relative URLs and data/base64 URIs are passed through
// untouched so external, CDN or Base64 images always render.
export function resolveMedia(src) {
  if (!src) return '';
  const s = String(src).replace(/\\/g, '/');
  if (s.startsWith(API_ORIGIN)) return s;
  if (/^(https?:)?\/\//i.test(s) || s.startsWith('data:') || s.startsWith('blob:')) return s;
  return API_ORIGIN + (s.startsWith('/') ? s : `/uploads/${s.replace(/^\/+/g, '')}`);
}

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