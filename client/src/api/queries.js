import { api } from './client.js';

export const queriesApi = {
  list: (params) => api.get('/queries', { params }).then((r) => r.data),
  stats: () => api.get('/queries/stats').then((r) => r.data.data),
  get: (id) => api.get(`/queries/${id}`).then((r) => r.data.data),
  create: (payload) => api.post('/queries', payload).then((r) => r.data.data),
  update: (id, payload) => api.put(`/queries/${id}`, payload).then((r) => r.data.data),
  setStatus: (id, status, lostReason, reminderOn) =>
    api.patch(`/queries/${id}/status`, { status, lostReason, reminderOn }).then((r) => r.data.data),
  remove: (id) => api.delete(`/queries/${id}`).then((r) => r.data.data),
  uploadCsv: (file, { source, owner } = {}) => {
    const fd = new FormData();
    fd.append('file', file);
    if (source) fd.append('source', source);
    if (owner) fd.append('owner', owner);
    return api.post('/queries/upload-csv', fd).then((r) => r.data.data);
  },
};
