import { api } from './client.js';

export const optionsApi = {
  search: (category, search = '') =>
    api.get('/options', { params: { category, search } }).then((r) => r.data.data),
  usage: (category, search = '', disabled = false) =>
    api.get('/options/usage', { params: { category, search, ...(disabled ? { disabled: true } : {}) } }).then((r) => r.data.data),
  create: (category, value, description, extra = {}) =>
    api.post('/options', { category, value, ...(description !== undefined ? { description } : {}), ...extra }).then((r) => r.data.data),
  update: (id, patch) => api.patch(`/options/${id}`, patch).then((r) => r.data.data),
  remove: (id) => api.delete(`/options/${id}`).then((r) => r.data.data),
  bulkDeleteUnused: (category) => api.post('/options/bulk-delete-unused', { category }).then((r) => r.data.data),
};
