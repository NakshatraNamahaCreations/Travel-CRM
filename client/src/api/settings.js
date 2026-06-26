import { api } from './client.js';

export const usersApi = {
  list: (params) => api.get('/users', { params }).then((r) => r.data),
  get: (id) => api.get(`/users/${id}`).then((r) => r.data.data),
  create: (payload) => api.post('/users', payload).then((r) => r.data.data),
  update: (id, payload) => api.put(`/users/${id}`, payload).then((r) => r.data.data),
  setStatus: (id, isActive) => api.patch(`/users/${id}/status`, { isActive }).then((r) => r.data.data),
};

export const teamsApi = {
  list: (params) => api.get('/teams', { params }).then((r) => r.data),
  create: (payload) => api.post('/teams', payload).then((r) => r.data.data),
  update: (id, payload) => api.put(`/teams/${id}`, payload).then((r) => r.data.data),
  remove: (id) => api.delete(`/teams/${id}`).then((r) => r.data.data),
};

export const profileApi = {
  update: (payload) => api.patch('/auth/profile', payload).then((r) => r.data.data.user),
};
