import { api } from './client.js';

export const serviceBookingsApi = {
  list: (queryId, kind) => api.get('/service-bookings', { params: { query: queryId, ...(kind ? { kind } : {}) } }).then((r) => r.data.data),
  generate: (queryId, quoteId, kind) => api.post('/service-bookings/generate', { query: queryId, quote: quoteId, ...(kind ? { kind } : {}) }).then((r) => r.data.data),
  update: (id, patch) => api.patch(`/service-bookings/${id}`, patch).then((r) => r.data.data),
  remove: (id) => api.delete(`/service-bookings/${id}`).then((r) => r.data.data),
};
