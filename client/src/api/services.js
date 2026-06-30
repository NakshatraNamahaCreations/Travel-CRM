import { api } from './client.js';

// Generic REST resource helper (list/get/create/update/remove).
function resource(path) {
  return {
    list: (params) => api.get(`/${path}`, { params }).then((r) => r.data),
    get: (id) => api.get(`/${path}/${id}`).then((r) => r.data.data),
    create: (payload) => api.post(`/${path}`, payload).then((r) => r.data.data),
    update: (id, payload) => api.put(`/${path}/${id}`, payload).then((r) => r.data.data),
    remove: (id) => api.delete(`/${path}/${id}`).then((r) => r.data.data),
  };
}

export const importApi = {
  upload: (file, type = 'auto', destinations = []) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', type);
    if (destinations.length) fd.append('destinations', JSON.stringify(destinations));
    return api.post('/services/import', fd).then((r) => r.data.data);
  },
};

export const hotelsApi = resource('hotels');
hotelsApi.merge = (source, target) => api.post('/hotels/merge', { source, target }).then((r) => r.data.data);
hotelsApi.bulkRemove = (ids) => api.post('/hotels/bulk-delete', { ids }).then((r) => r.data.data);
hotelsApi.getBookings = (id) => api.get(`/hotels/${id}/bookings`).then((r) => r.data.data);
hotelsApi.getPayments = (id, params) => api.get(`/hotels/${id}/payments`, { params }).then((r) => r.data);
export const hotelPricesApi = resource('hotel-prices');
export const transportApi = resource('transport-services');
transportApi.bulkDisable = () => api.post('/transport-services/bulk-disable').then((r) => r.data.data);
transportApi.bulkRemove = (ids) => api.post('/transport-services/bulk-delete', { ids }).then((r) => r.data.data);
export const transportPricesApi = resource('transport-prices');
export const activitiesApi = resource('travel-activities');
activitiesApi.bulkDisable = () => api.post('/travel-activities/bulk-disable').then((r) => r.data.data);
export const activityPricesApi = resource('travel-activity-prices');
