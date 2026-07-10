import { api } from './client.js';

// Generic master-data accessor for the resources used by the query form.
const resource = (path) => ({
  search: (search = '', limit = 20) =>
    api.get(`/${path}`, { params: { search, limit } }).then((r) => r.data.data),
  create: (payload) => api.post(`/${path}`, payload).then((r) => r.data.data),
});

export const destinationsApi = resource('destinations');
// Full management (used by the Destinations admin page).
destinationsApi.list = (params) => api.get('/destinations', { params }).then((r) => r.data);
destinationsApi.update = (id, payload) => api.put(`/destinations/${id}`, payload).then((r) => r.data.data);
destinationsApi.remove = (id) => api.delete(`/destinations/${id}`).then((r) => r.data.data);
export const querySourcesApi = resource('query-sources');
export const tagsApi = resource('tags');
export const teamsApi = resource('teams');

// Inclusions / Exclusions master (defaults shown on quotations).
export const inclusionExclusionApi = {
  list: (params) => api.get('/inclusion-exclusions', { params }).then((r) => r.data),
  create: (payload) => api.post('/inclusion-exclusions', payload).then((r) => r.data.data),
  update: (id, payload) => api.put(`/inclusion-exclusions/${id}`, payload).then((r) => r.data.data),
  remove: (id) => api.delete(`/inclusion-exclusions/${id}`).then((r) => r.data.data),
};

export const usersApi = {
  search: (search = '', limit = 20) =>
    api.get('/users', { params: { search, limit } }).then((r) => r.data.data),
};
