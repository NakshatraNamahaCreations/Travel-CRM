import { api } from './client.js';

export const reportsApi = {
  sales: (params) => api.get('/reports/sales', { params }).then((r) => r.data.data),
  dashboard: (params) => api.get('/reports/dashboard', { params }).then((r) => r.data.data),
  trips: (params) => api.get('/reports/trips', { params }).then((r) => r.data.data),
  tripCheckInOut: (params) => api.get('/reports/trip-check-in-out', { params }).then((r) => r.data.data),
};
