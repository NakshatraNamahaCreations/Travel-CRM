import { api } from './client.js';

// Customer-facing document links. The server mints a random token on first
// request and returns an absolute, publicly-openable URL — safe to paste into
// a WhatsApp message. `revoke` invalidates any link already shared.
export const shareLinksApi = {
  create: (kind, id) => api.post('/share-links', { kind, id }).then((r) => r.data.data),
  revoke: (kind, id) => api.delete('/share-links', { data: { kind, id } }).then((r) => r.data.data),
};
