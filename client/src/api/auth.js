import { api } from './client.js';

export const authApi = {
  login: (payload) => api.post('/auth/login', payload).then((r) => r.data.data),
  register: (payload) => api.post('/auth/register', payload).then((r) => r.data.data),
  logout: () => api.post('/auth/logout').then((r) => r.data.data),
  me: () =>
    api.get('/auth/me', { _skipAuthRedirect: true }).then((r) => r.data.data.user),
};
