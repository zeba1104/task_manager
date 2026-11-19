import api from './axios';

/**
 * Payroll API Client
 * Provides full end-to-end access to Salary Structure, Monthly Calculations,
 * Multi-Stage Approvals, RazorpayX Payouts, and Payslips.
 */

// 1. Gateway Status & Diagnostics
export const getGatewayStatus = () => api.get('/payroll/gateway/status');

// 2. Salary Structures
export const getSalaryStructures = () => api.get('/payroll/salary-structures');
export const getEmployeeSalaryStructure = (employeeId) => api.get(`/payroll/salary-structures/${employeeId}`);
export const upsertSalaryStructure = (data) => api.post('/payroll/salary-structures', data);

// 3. Payroll Generation & Listing
export const generateMonthlyPayroll = (data) => api.post('/payroll/generate', data);
export const getAllPayrolls = (params) => api.get('/payroll', { params });
export const getTeamPayrolls = (params) => api.get('/payroll/team', { params });
export const getMyPayrolls = () => api.get('/payroll/my');
export const getPayrollById = (id) => api.get(`/payroll/${id}`);

// 4. Approvals & Recalculation
export const managerReviewPayroll = (id, data) => api.post(`/payroll/${id}/manager-review`, data);
export const managerBulkApprove = (data) => api.post('/payroll/team/bulk-approve', data);
export const adminReviewPayroll = (id, data) => api.post(`/payroll/${id}/admin-review`, data);
export const recalculatePayroll = (id) => api.post(`/payroll/${id}/recalculate`);

// 5. RazorpayX Outbound Payouts
export const initiatePayout = (id, data) => api.post(`/payroll/${id}/initiate-payout`, data);
export const batchInitiatePayouts = (data) => api.post('/payroll/batch/initiate-payouts', data);
export const retryPayout = (id) => api.post(`/payroll/${id}/retry-payout`);
