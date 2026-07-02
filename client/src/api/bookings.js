import { api } from './client.js';

export const bookingsApi = {
  list: (params) => api.get('/bookings', { params }).then((r) => r.data),
  get: (id) => api.get(`/bookings/${id}`).then((r) => r.data.data),
  fromQuote: (quoteId, payload) => api.post(`/bookings/from-quote/${quoteId}`, payload || {}).then((r) => r.data.data),
  setStatus: (id, status) => api.patch(`/bookings/${id}/status`, { status }).then((r) => r.data.data),
  remove: (id) => api.delete(`/bookings/${id}`).then((r) => r.data.data),

  updateInstalmentSchedule: (id, payload) => api.put(`/bookings/${id}/instalment-schedule`, payload).then((r) => r.data.data),

  // Derived views
  hotels: (params) => api.get('/bookings/views/hotels', { params }).then((r) => r.data),
  hotelCheckins: (params) => api.get('/bookings/views/hotel-checkins', { params }).then((r) => r.data),
  operational: (params) => api.get('/bookings/views/operational', { params }).then((r) => r.data),
  quoteDiff: (params) => api.get('/bookings/views/quote-diff', { params }).then((r) => r.data),
};
