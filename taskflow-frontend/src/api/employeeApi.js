import api from './axios';

// 1.1 Employee Dashboard
export const getEmployeeDashboard = () => api.get('/employee/dashboard');
export const getUpcomingMeetings = () => api.get('/employee/meetings');
export const clockIn = (data = {}) => api.post('/attendance/in', data);
export const clockOut = (seconds = 0) => api.post('/attendance/out', { seconds });
export const applyLeave = (data) => {
    if (data instanceof FormData) {
        return api.post('/leave/apply', data, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    }
    return api.post('/leave/apply', data);
};
export const getMyLeaveRequests = () => api.get('/leave/mine');
export const cancelLeave = (id) => api.post(`/leave/${id}/cancel`);

// 1.2 My Profile & Department Information
export const getEmployeeProfile = () => api.get('/employee/profile');
export const updatePermittedProfile = (data) => api.put('/employee/profile', data);
export const changeEmployeePassword = (data) => api.put('/employee/password', data);
export const requestProfileChange = (data) => api.post('/employee/profile-change-requests', data);
export const uploadProfilePicture = (id, formData) => api.post(`/users/${id}/profile-picture`, formData);
export const deleteProfilePicture = (id) => api.delete(`/users/${id}/profile-picture`);

// 1.3 My Projects
export const getMyProjects = () => api.get('/employee/projects');
export const getProjectDetails = (id) => api.get(`/employee/projects/${id}`);
export const uploadProjectDocument = (id, formData) => api.post(`/employee/projects/${id}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
});
export const addProjectComment = (id, data) => api.post(`/employee/projects/${id}/comments`, data);

// 1.4 My Tasks
export const getMyTasks = () => api.get('/employee/tasks');
export const getTaskDetails = (id) => api.get(`/employee/tasks/${id}`);
export const updateTaskStatus = (id, status) => api.put(`/employee/tasks/${id}/status`, { status });
export const submitTaskForReview = (id, data) => api.post(`/employee/tasks/${id}/submit-work`, data);
export const resubmitTask = (id, data) => api.post(`/employee/tasks/${id}/resubmit`, data);
export const addTaskProgressUpdate = (id, data) => api.post(`/employee/tasks/${id}/progress-update`, data);
