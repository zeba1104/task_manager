const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getSalaryStructures,
  getEmployeeSalaryStructure,
  upsertSalaryStructure,
  generateMonthlyPayroll,
  getAllPayrolls,
  getTeamPayrolls,
  getMyPayrolls,
  getPayrollById,
  managerReviewPayroll,
  managerBulkApprove,
  adminReviewPayroll,
  recalculatePayroll,
  initiatePayout,
  batchInitiatePayouts,
  retryPayout,
  getGatewayStatus,
  handleWebhook
} = require('../controllers/payrollController');

// Webhook endpoint (unauthenticated - validates signature internally)
router.post('/webhook', handleWebhook);

// Protected routes (require valid JWT)
router.use(authMiddleware);

// Gateway status & diagnostics
router.get('/gateway/status', getGatewayStatus);

// Salary structures
router.get('/salary-structures', getSalaryStructures);
router.get('/salary-structures/:employeeId', getEmployeeSalaryStructure);
router.post('/salary-structures', upsertSalaryStructure);

// Payroll generation & retrieval
router.post('/generate', generateMonthlyPayroll);
router.get('/', getAllPayrolls);
router.get('/team', getTeamPayrolls);
router.get('/my', getMyPayrolls);
router.get('/:id', getPayrollById);

// Reviews & Approvals
router.post('/team/bulk-approve', managerBulkApprove);
router.post('/:id/manager-review', managerReviewPayroll);
router.post('/:id/admin-review', adminReviewPayroll);
router.post('/:id/recalculate', recalculatePayroll);

// RazorpayX Payouts
router.post('/batch/initiate-payouts', batchInitiatePayouts);
router.post('/:id/initiate-payout', initiatePayout);
router.post('/:id/retry-payout', retryPayout);

module.exports = router;
