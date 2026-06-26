import { api } from './client.js';

export const quotesApi = {
  listForQuery: (queryId) => api.get('/quotes', { params: { query: queryId } }).then((r) => r.data.data),
  get: (id) => api.get(`/quotes/${id}`).then((r) => r.data.data),
  create: (payload) => api.post('/quotes', payload).then((r) => r.data.data),
  update: (id, payload) => api.put(`/quotes/${id}`, payload).then((r) => r.data.data),
  setStatus: (id, status) => api.patch(`/quotes/${id}/status`, { status }).then((r) => r.data.data),
  remove: (id) => api.delete(`/quotes/${id}`).then((r) => r.data.data),
  pdf: (id) => api.get(`/quotes/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data),
  email: (id, email) => api.post(`/quotes/${id}/email`, email ? { email } : {}).then((r) => r.data.data),
  emailStatus: () => api.get('/quotes/email-status').then((r) => r.data.data),
};

export const lookupApi = {
  hotelRate: (params) => api.get('/lookups/hotel-rate', { params }).then((r) => r.data.data),
  activityRate: (params) => api.get('/lookups/activity-rate', { params }).then((r) => r.data.data),
  transportRate: (params) => api.get('/lookups/transport-rate', { params }).then((r) => r.data.data),
};
