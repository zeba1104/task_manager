import api from './axios';

// Overview & Profile
export const getManagerOverview = () => api.get('/manager/overview');
export const getManagerProfile = () => api.get('/manager/profile');
export const updateManagerProfile = (data) => api.put('/manager/profile', data);
export const changeManagerPassword = (data) => api.put('/manager/password', data);
export const requestProfileChange = (data) => api.post('/manager/profile-change-requests', data);
export const uploadProfilePicture = (id, formData) => api.post(`/users/${id}/profile-picture`, formData);
export const deleteProfilePicture = (id) => api.delete(`/users/${id}/profile-picture`);
export const reviewManagerLeave = (id, status, reason = '') => api.patch(`/admin/leave/${id}`, { status, reason });
export const reviewManagerProfileChange = (id, status) => api.patch(`/admin/profile-change-requests/${id}`, { status });

// Manager Leave Management
export const applyManagerLeave = (data) => {
    if (data instanceof FormData) {
        return api.post('/leave/apply', data, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    }
    return api.post('/leave/apply', data);
};
export const getMyManagerLeaves = () => api.get('/leave/mine');
export const cancelManagerLeave = (id) => api.post(`/leave/${id}/cancel`);
export const getManagerTeamLeaves = () => api.get('/leave/manager/team');

// 1.3 Team Management
export const getTeamMembers = () => api.get('/manager/team');
export const getEmployeeProfile = (id) => api.get(`/manager/team/employee/${id}`);
export const addEmployeeFeedback = (id, data) => api.post(`/manager/team/employee/${id}/feedback`, data);
export const requestEmployeeTransfer = (data) => api.post('/manager/team/transfer-request', data);
export const getTransferRequests = () => api.get('/manager/team/transfer-requests');
export const getTeamPerformanceReports = () => api.get('/manager/team/performance-reports');

// 1.4 Project Management
export const getManagerProjects = () => api.get('/manager/projects');
export const getManagerProjectDetails = (id) => api.get(`/manager/projects/${id}`);
export const createManagerProject = (data) => api.post('/manager/projects', data);
export const updateManagerProject = (id, data) => api.put(`/manager/projects/${id}`, data);
export const addProjectMilestone = (id, data) => api.post(`/manager/projects/${id}/milestones`, data);
export const updateProjectMilestone = (id, milestoneId, data) => api.put(`/manager/projects/${id}/milestones/${milestoneId}`, data);
export const deleteProjectMilestone = (id, milestoneId) => api.delete(`/manager/projects/${id}/milestones/${milestoneId}`);
export const uploadProjectDocument = (id, formData) => api.post(`/manager/projects/${id}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
});
export const deleteProjectDocument = (id, docId) => api.delete(`/manager/projects/${id}/documents/${docId}`);
export const addProjectComment = (id, data) => api.post(`/manager/projects/${id}/comments`, data);
export const notifyAdminProjectUpdate = (id, data) => api.post(`/manager/projects/${id}/notify-admin`, data);
export const generateProjectProgressReport = (id) => api.get(`/manager/projects/${id}/report`);

// Task Review Workflow
export const getTasksForReview = () => api.get('/manager/tasks/reviews');
export const reviewTaskSubmission = (id, data) => api.post(`/manager/tasks/${id}/review`, data);
