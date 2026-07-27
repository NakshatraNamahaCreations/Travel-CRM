import axios from 'axios';

export const TOKEN_KEY = 'tcrm_token';

// In dev, '/api' is proxied to the local server (see vite.config.js).
// In production (Netlify), VITE_API_URL points at the deployed backend.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

// Attach the bearer token on every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normalize errors, auto-logout on 401, and bounce locked-out organizations
// (suspended by the platform owner / subscription expired) to the login page.
const LOCKOUT_CODES = { ORG_SUSPENDED: 'suspended', SUBSCRIPTION_EXPIRED: 'expired' };

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const message =
      error.response?.data?.message || error.message || 'Something went wrong';
    if (status === 403 && LOCKOUT_CODES[code] && window.location.pathname !== '/login') {
      localStorage.removeItem(TOKEN_KEY);
      window.location.assign(`/login?reason=${LOCKOUT_CODES[code]}`);
    } else if (status === 401 && !error.config?._skipAuthRedirect) {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(Object.assign(error, { message }));
  }
);
