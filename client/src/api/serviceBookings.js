import { api } from './client.js';

export const serviceBookingsApi = {
  list: (queryId, kind) => api.get('/service-bookings', { params: { query: queryId, ...(kind ? { kind } : {}) } }).then((r) => r.data.data),
  generate: (queryId, quoteId, kind) => api.post('/service-bookings/generate', { query: queryId, quote: quoteId, ...(kind ? { kind } : {}) }).then((r) => r.data.data),
  update: (id, patch) => api.patch(`/service-bookings/${id}`, patch).then((r) => r.data.data),
  remove: (id) => api.delete(`/service-bookings/${id}`).then((r) => r.data.data),

  hotelInfo: (id) => api.get(`/service-bookings/${id}/hotel-info`).then((r) => r.data.data),
  voucherHtml: (id, payload) => api.post(`/service-bookings/${id}/voucher?format=html`, payload).then((r) => r.data),
  voucherPdf: (id, payload) => api.post(`/service-bookings/${id}/voucher`, payload, { responseType: 'blob' }).then((r) => r.data),
};
