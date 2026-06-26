import { api } from './client.js';

export const accountsApi = {
  list: (params) => api.get('/accounts', { params }).then((r) => r.data),
  get: (id) => api.get(`/accounts/${id}`).then((r) => r.data.data),
  create: (payload) => api.post('/accounts', payload).then((r) => r.data.data),
  update: (id, patch) => api.patch(`/accounts/${id}`, patch).then((r) => r.data.data),
  remove: (id) => api.delete(`/accounts/${id}`).then((r) => r.data.data),
};

export const transactionsApi = {
  list: (params) => api.get('/transactions', { params }).then((r) => r.data),
  summary: (params) => api.get('/transactions/summary', { params }).then((r) => r.data.data),
  create: (payload) => api.post('/transactions', payload).then((r) => r.data.data),
  remove: (id) => api.delete(`/transactions/${id}`).then((r) => r.data.data),
};

export const gatewaysApi = {
  list: () => api.get('/gateways').then((r) => r.data.data),
  transactions: (params) => api.get('/gateways/transactions', { params }).then((r) => r.data),
  summary: (params) => api.get('/gateways/summary', { params }).then((r) => r.data.data),
};
