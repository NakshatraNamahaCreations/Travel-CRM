import { api } from './client.js';

export const hotelNotesApi = {
  list: () => api.get('/hotel-notes').then((r) => r.data.data),
  create: (payload) => api.post('/hotel-notes', payload).then((r) => r.data.data),
  remove: (id) => api.delete(`/hotel-notes/${id}`).then((r) => r.data.data),
};
