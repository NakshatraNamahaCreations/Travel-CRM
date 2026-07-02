import { api } from './client.js';

export const notificationsApi = {
  list:        (params) => api.get('/notifications', { params }).then((r) => r.data),
  unreadCount: ()       => api.get('/notifications/unread-count').then((r) => r.data.data),
  markRead:    (id)     => api.patch(`/notifications/${id}/read`).then((r) => r.data.data),
  markAllRead: ()       => api.patch('/notifications/read-all').then((r) => r.data.data),
  remove:      (id)     => api.delete(`/notifications/${id}`).then((r) => r.data.data),
  clearAll:    ()       => api.delete('/notifications/clear-all').then((r) => r.data.data),
};
