import { api } from './client.js';

export const installmentsApi = {
  list: (params) => api.get('/installments', { params }).then((r) => r.data),
  summary: (params) => api.get('/installments/summary', { params }).then((r) => r.data.data),
  accounts: (search) => api.get('/installments/accounts', { params: { search } }).then((r) => r.data.data),
  create: (payload) => api.post('/installments', payload).then((r) => r.data.data),
  logPayment: (id, payload) => api.post(`/installments/${id}/log-payment`, payload).then((r) => r.data.data),
  receipt: (id) => api.get(`/installments/${id}/receipt`, { responseType: 'blob' }).then((r) => r.data),
  verify: (id) => api.patch(`/installments/${id}/verify`).then((r) => r.data.data),
  addComment: (id, body) => api.post(`/installments/${id}/comments`, { body }).then((r) => r.data.data),
  remove: (id) => api.delete(`/installments/${id}`).then((r) => r.data.data),
};
