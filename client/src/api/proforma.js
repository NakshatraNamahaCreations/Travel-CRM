import { api } from './client.js';

export const proformaApi = {
  list: (queryId) => api.get('/proforma-invoices', { params: { query: queryId } }).then((r) => r.data.data),
  create: (payload) => api.post('/proforma-invoices', payload).then((r) => r.data.data),
  update: (id, payload) => api.patch(`/proforma-invoices/${id}`, payload).then((r) => r.data.data),
  remove: (id) => api.delete(`/proforma-invoices/${id}`).then((r) => r.data.data),
  pdf: (id) => api.get(`/proforma-invoices/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data),
};
