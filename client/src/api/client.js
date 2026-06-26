import axios from 'axios';

export const TOKEN_KEY = 'tcrm_token';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Attach the bearer token on every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normalize errors and auto-logout on 401.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.message || error.message || 'Something went wrong';
    if (status === 401 && !error.config?._skipAuthRedirect) {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(Object.assign(error, { message }));
  }
);
