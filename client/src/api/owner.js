import { api } from './client.js';

// Platform-owner panel endpoints (role 'owner' only).
export const ownerApi = {
  listOrganizations: () => api.get('/owner/organizations').then((r) => r.data.data),
  createOrganization: (payload) => api.post('/owner/organizations', payload).then((r) => r.data.data),
  getOrganization: (id) => api.get(`/owner/organizations/${id}`).then((r) => r.data.data),
  updateOrganization: (id, payload) => api.patch(`/owner/organizations/${id}`, payload).then((r) => r.data.data),
  recordSubscription: (id, payload) => api.post(`/owner/organizations/${id}/subscription`, payload).then((r) => r.data.data),

  listPlans: () => api.get('/owner/plans').then((r) => r.data.data),
  createPlan: (payload) => api.post('/owner/plans', payload).then((r) => r.data.data),
  updatePlan: (id, payload) => api.patch(`/owner/plans/${id}`, payload).then((r) => r.data.data),
};
