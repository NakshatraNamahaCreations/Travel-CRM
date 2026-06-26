import { api } from './client.js';

export const tasksApi = {
  list: (params) => api.get('/comments/tasks', { params }).then((r) => r.data),
  resolve: (id) => api.patch(`/comments/${id}`, { isResolved: true }).then((r) => r.data.data),
};
