import { api } from './client.js';

// Generic master-data accessor for the resources used by the query form.
const resource = (path) => ({
  search: (search = '', limit = 20) =>
    api.get(`/${path}`, { params: { search, limit } }).then((r) => r.data.data),
  create: (payload) => api.post(`/${path}`, payload).then((r) => r.data.data),
});

export const destinationsApi = resource('destinations');
export const querySourcesApi = resource('query-sources');
export const tagsApi = resource('tags');
export const teamsApi = resource('teams');

export const usersApi = {
  search: (search = '', limit = 20) =>
    api.get('/users', { params: { search, limit } }).then((r) => r.data.data),
};
