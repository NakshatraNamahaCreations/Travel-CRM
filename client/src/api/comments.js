import { api } from './client.js';

export const commentsApi = {
  listForQuery: (queryId) => api.get('/comments', { params: { query: queryId } }).then((r) => r.data.data),
  create: (payload) => api.post('/comments', payload).then((r) => r.data.data),
  update: (id, payload) => api.patch(`/comments/${id}`, payload).then((r) => r.data.data),
  remove: (id) => api.delete(`/comments/${id}`).then((r) => r.data.data),
};
