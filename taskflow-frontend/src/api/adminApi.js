import api from './axios';

export const getAdminOverview = () => api.get('/admin/overview');
export const getDepartments = () => api.get('/admin/departments');
export const getProjects = () => api.get('/admin/projects');
export const createDepartment = (data) => api.post('/admin/departments', data);
export const updateDepartment = (id, data) => api.put(`/admin/departments/${id}`, data);
export const createProject = (data) => api.post('/admin/projects', data);
export const createAnnouncement = (data) => api.post('/admin/announcements', data);
export const getAnnouncements = () => api.get('/admin/announcements');
export const createLeaveRequest = (data) => api.post('/admin/leave', data);
export const getMyLeaveRequests = () => api.get('/admin/leave/mine');
export const reviewLeaveRequest = (id, status) => api.patch(`/admin/leave/${id}`, { status });
export const getAdminLeaveRequests = (params = {}) => api.get('/leave/admin/all', { params });
export const overrideLeaveAsAdmin = (id, action, reason = '') => api.post(`/leave/admin/${id}/override`, { action, reason });
export const reviewManagerProfileChange = (id, status) => api.patch(`/admin/profile-change-requests/${id}`, { status });

export const getTransferRequests = () => api.get('/admin/transfer-requests');
export const reviewTransferRequest = (id, data) => api.patch(`/admin/transfer-requests/${id}`, data);
export const getAdminNotifications = () => api.get('/admin/notifications');
export const markAdminNotificationRead = (id) => api.patch(`/admin/notifications/${id}/read`);

// User & Account Management (Admin Authority)
export const getAllUsers = () => api.get('/users');
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const deleteUser = (id) => api.delete(`/users/${id}`);
export const resendCredentials = (id) => api.post(`/users/${id}/resend-credentials`);
export const uploadProfilePicture = (id, formData) => api.post(`/users/${id}/profile-picture`, formData);
export const deleteProfilePicture = (id) => api.delete(`/users/${id}/profile-picture`);
export const getUserProfile = (id) => api.get(`/users/${id}/profile`);
