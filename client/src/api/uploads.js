import { api } from './client.js';

export const uploadsApi = {
  // Uploads a local image file, returns its hosted (Cloudinary) URL.
  image: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/uploads/image', fd).then((r) => r.data.data.url);
  },
};
