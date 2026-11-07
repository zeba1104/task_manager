import api from './axios';

/**
 * Apply for a new leave request (Employee or Manager).
 * Supports multipart FormData if supporting document is attached.
 */
export const applyLeaveRequest = (data) => {
  if (data instanceof FormData) {
    return api.post('/leave/apply', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
  return api.post('/leave/apply', data);
};

/**
 * Fetch current user's leave balance, request history, and stats.
 */
export const getMyLeaveOverview = () => api.get('/leave/mine');

/**
 * Cancel a pending leave request.
 */
export const cancelMyLeaveRequest = (id) => api.post(`/leave/${id}/cancel`);

/**
 * Admin: Fetch all leave requests across the company with filters.
 */
export const getAdminLeaveRequests = (params = {}) => api.get('/leave/admin/all', { params });

/**
 * Admin: Manually override a leave request (Approve or Reject with reason).
 */
export const overrideLeaveAsAdmin = (id, action, reason = '') =>
  api.post(`/leave/admin/${id}/override`, { action, reason });

/**
 * Manager: Fetch team members' leave requests.
 */
export const getManagerTeamLeaves = () => api.get('/leave/manager/team');
