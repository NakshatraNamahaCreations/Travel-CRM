import { api } from './client.js';

function resource(path) {
  return {
    list: (params) => api.get(`/${path}`, { params }).then((r) => r.data),
    get: (id) => api.get(`/${path}/${id}`).then((r) => r.data.data),
    create: (payload) => api.post(`/${path}`, payload).then((r) => r.data.data),
    update: (id, payload) => api.put(`/${path}/${id}`, payload).then((r) => r.data.data),
    remove: (id) => api.delete(`/${path}/${id}`).then((r) => r.data.data),
    search: (q = '') => api.get(`/${path}`, { params: { search: q, limit: 50 } }).then((r) => r.data.data || r.data.items || []),
  };
}

export const statesApi = resource('states');
export const citiesApi = resource('cities');
