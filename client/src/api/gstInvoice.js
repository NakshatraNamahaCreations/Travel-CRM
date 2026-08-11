import { api } from './client.js';

export const gstInvoiceApi = {
  listForInstallment: (installmentId) => api.get('/gst-invoices', { params: { installment: installmentId } }).then((r) => r.data.data),
  listForQuery: (queryId) => api.get('/gst-invoices', { params: { query: queryId } }).then((r) => r.data.data),
  create: (payload) => api.post('/gst-invoices', payload).then((r) => r.data.data),
  update: (id, payload) => api.patch(`/gst-invoices/${id}`, payload).then((r) => r.data.data),
  remove: (id) => api.delete(`/gst-invoices/${id}`).then((r) => r.data.data),
  pdf: (id) => api.get(`/gst-invoices/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data),
};
