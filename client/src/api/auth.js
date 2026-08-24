import { api } from './client.js';

export const authApi = {
  login: (payload) => api.post('/auth/login', payload).then((r) => r.data.data),
  logout: () => api.post('/auth/logout').then((r) => r.data.data),
  me: () =>
    api.get('/auth/me', { _skipAuthRedirect: true }).then((r) => r.data.data.user),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }).then((r) => r.data.data),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }).then((r) => r.data.data),
};
