import { api } from './client.js';

export const paymentsApi = {
  list: (params) => api.get('/payments', { params }).then((r) => r.data),
  summary: () => api.get('/payments/summary').then((r) => r.data.data),
  supplierLedger: () => api.get('/payments/supplier-ledger').then((r) => r.data.data),
  create: (payload) => api.post('/payments', payload).then((r) => r.data.data),
  update: (id, payload) => api.patch(`/payments/${id}`, payload).then((r) => r.data.data),
  remove: (id) => api.delete(`/payments/${id}`).then((r) => r.data.data),
};
