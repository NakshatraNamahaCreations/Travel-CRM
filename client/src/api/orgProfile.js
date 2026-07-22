import { api } from './client.js';

export const orgProfileApi = {
  get: () => api.get('/org-profile').then((r) => r.data.data),
  update: (payload) => api.put('/org-profile', payload).then((r) => r.data.data),
};
