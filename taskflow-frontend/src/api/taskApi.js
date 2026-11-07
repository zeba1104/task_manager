import api from './axios';

export const getTasks = (params = {}) => api.get('/task', { params });
export const createTask = (data) => api.post('/task', data);
export const getTaskById = (id) => api.get(`/task/${id}`);
export const updateTask = (id, data) => api.put(`/task/${id}`, data);
export const deleteTask = (id) => api.delete(`/task/${id}`);
export const addTaskComment = (id, text) => api.post(`/task/${id}/comments`, { text });
export const uploadTaskAttachment = (id, file) => {
	const formData = new FormData();
	formData.append('file', file);
	return api.post(`/task/${id}/attachments`, formData);
};
export const downloadTaskAttachment = (id, attachmentId) =>
	api.get(`/task/${id}/attachments/${attachmentId}`, { responseType: 'blob' });
export const deleteTaskAttachment = (id, attachmentId) =>
	api.delete(`/task/${id}/attachments/${attachmentId}`);
export const getUsers = () => api.get('/auth/users');
export const getAttendance = () => api.get('/attendance');
export const startFocusSession = (data) => api.post('/focus/start', data);
export const stopFocusSession = (data) => api.post('/focus/stop', data);
export const getFocusSessions = (params) => api.get('/focus', { params });