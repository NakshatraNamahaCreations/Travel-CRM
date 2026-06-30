import { api } from './client.js';

// Audit/activity log for a query/trip.
export const activityLogApi = {
  list: (queryId) => api.get('/activity-log', { params: { query: queryId } }).then((r) => r.data.data),
  listForTransport: (id) => api.get('/activity-log', { params: { transport: id } }).then((r) => r.data.data),
};
