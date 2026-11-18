import api from './axios';

export const getHolidays = (params = {}) => api.get('/holidays', { params });
export const getUpcomingHoliday = () => api.get('/holidays/upcoming');
export const createHoliday = (data) => api.post('/holidays', data);
export const updateHoliday = (id, data) => api.put(`/holidays/${id}`, data);
export const deleteHoliday = (id) => api.delete(`/holidays/${id}`);
