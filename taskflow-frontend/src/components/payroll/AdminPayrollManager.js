import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CreditCard,
  DollarSign,
  CheckCircle,
  Clock,
  Send,
  RefreshCw,
  Eye,
  Edit3,
  Landmark,
  Search,
  HelpCircle,
  Check,
  X
} from 'lucide-react';
import {
  getAllPayrolls,
  generateMonthlyPayroll,
  adminReviewPayroll,
  recalculatePayroll,
  initiatePayout,
  batchInitiatePayouts,
  retryPayout,
  getSalaryStructures,
  upsertSalaryStructure,
  getGatewayStatus
} from '../../api/payrollApi';
import PayslipModal from './PayslipModal';
import Swal from '../../utils/swalConfig';
import './Payroll.css';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function AdminPayrollManager({ user }) {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'pending' | 'ready' | 'paid' | 'failed' | 'structures'
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [loading, setLoading] = useState(false);
  const [payrolls, setPayrolls] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [gatewayInfo, setGatewayInfo] = useState(null);
  const [salaryStructures, setSalaryStructures] = useState([]);

  // Modal / Drawer states
  const [selectedPayslipPayroll, setSelectedPayslipPayroll] = useState(null);
  const [showGatewayGuide, setShowGatewayGuide] = useState(false);
  const [editingStructure, setEditingStructure] = useState(null);
  const [payoutInProgressId, setPayoutInProgressId] = useState(null);

  // Load Gateway Status
  useEffect(() => {
    getGatewayStatus()
      .then((res) => setGatewayInfo(res.data))
      .catch((err) => console.warn('Could not fetch gateway info:', err));
  }, []);

  // Fetch Payroll Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAllPayrolls({
        month: selectedMonth,
        year: selectedYear
      });
      setPayrolls(res.data.data || []);
      setKpis(res.data.kpis || null);
    } catch (err) {
      console.error('Failed to load payroll records:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  // Fetch Salary Structures
  const fetchStructures = useCallback(async () => {
    try {
      const res = await getSalaryStructures();
      setSalaryStructures(res.data.data || []);
    } catch (err) {
      console.error('Failed to load salary structures:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    if (activeTab === 'structures') {
      fetchStructures();
    }
  }, [fetchData, fetchStructures, activeTab]);

  // Handle Payroll Generation
  const handleGenerate = async () => {
    const monthLabel = MONTH_NAMES[selectedMonth - 1];
    const result = await Swal.fire({
      title: `Generate Payroll for ${monthLabel} ${selectedYear}?`,
      text: 'This will compile actual attendance records, approved leaves, and salary structures for all active employees.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Generate Payroll',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#4f46e5'
    });

    if (result.isConfirmed) {
      try {
        setLoading(true);
        const res = await generateMonthlyPayroll({
          month: selectedMonth,
          year: selectedYear
        });
        await Swal.fire({
          title: 'Payroll Generated!',
          text: `Successfully generated ${res.data.generatedCount} records (${res.data.skippedCount} skipped/already generated).`,
          icon: 'success'
        });
        fetchData();
      } catch (err) {
        Swal.fire({
          title: 'Generation Failed',
          text: err.response?.data?.message || err.message,
          icon: 'error'
        });
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle Admin Approval / Rejection
  const handleAdminReview = async (payroll, decision) => {
    const isApprove = decision === 'approved';
    const { value: remarks } = await Swal.fire({
      title: isApprove ? 'Approve for Payment?' : 'Reject / Return Payroll?',
      text: isApprove
        ? `This moves ${payroll.employee?.name}'s payroll to 'Ready for Payment' (RazorpayX).`
        : `Please specify the correction reason for ${payroll.employee?.name}:`,
      input: isApprove ? undefined : 'textarea',
      inputPlaceholder: 'Enter review remarks...',
      icon: isApprove ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonText: isApprove ? 'Approve Payroll' : 'Reject Payroll',
      confirmButtonColor: isApprove ? '#10b981' : '#ef4444'
    });

    if (isApprove || remarks !== undefined) {
      try {
        await adminReviewPayroll(payroll._id, {
          decision,
          remarks: remarks || (isApprove ? 'Approved by Admin for payout processing.' : '')
        });
        Swal.fire({
          title: isApprove ? 'Approved' : 'Rejected',
          text: isApprove ? 'Payroll marked Ready for Payment.' : 'Payroll returned.',
          icon: isApprove ? 'success' : 'info',
          timer: 1500,
          showConfirmButton: false
        });
        fetchData();
      } catch (err) {
        Swal.fire({ title: 'Action Failed', text: err.response?.data?.message || err.message, icon: 'error' });
      }
    }
  };

  // Handle Recalculate
  const handleRecalculate = async (payroll) => {
    try {
      await recalculatePayroll(payroll._id);
      Swal.fire({
        title: 'Recalculated',
        text: `Updated attendance & leave calculations for ${payroll.employee?.name}.`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
      fetchData();
    } catch (err) {
      Swal.fire({ title: 'Recalculation Failed', text: err.response?.data?.message || err.message, icon: 'error' });
    }
  };

  // Handle Single Payout
  const handleInitiatePayout = async (payroll) => {
    const confirm = await Swal.fire({
      title: `Disburse ₹${Number(payroll.netSalary).toLocaleString('en-IN')}?`,
      html: `
        <div style="text-align: left; font-size: 13px; line-height: 1.6;">
          <p><strong>Employee:</strong> ${payroll.employee?.name}</p>
          <p><strong>Bank Account:</strong> ${payroll.salaryStructureSnapshot?.bankDetails?.accountNumber ? '••••' + String(payroll.salaryStructureSnapshot.bankDetails.accountNumber).slice(-4) : '••••5678'}</p>
          <p><strong>IFSC:</strong> ${payroll.salaryStructureSnapshot?.bankDetails?.ifsc || 'HDFC0001234'}</p>
          <p><strong>Provider:</strong> ${gatewayInfo?.mode === 'sandbox_simulator' ? 'RazorpayX Test Sandbox (Simulated)' : 'RazorpayX Live / Test Payout'}</p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Confirm & Transfer',
      confirmButtonColor: '#4f46e5'
    });

    if (confirm.isConfirmed) {
      setPayoutInProgressId(payroll._id);
      try {
        const res = await initiatePayout(payroll._id, { transferMode: 'IMPS' });
        Swal.fire({
          title: 'Payout Processed!',
          html: `
            <div style="text-align: center; font-size: 13px;">
              <p>Salary disbursed successfully to <strong>${payroll.employee?.name}</strong>.</p>
              <p style="margin-top: 8px; font-family: monospace; background: #f1f5f9; padding: 6px; border-radius: 6px;">
                UTR: <strong>${res.data.data?.payout?.utr || 'UTRTEST-PROCESSED'}</strong>
              </p>
            </div>
          `,
          icon: 'success'
        });
        fetchData();
      } catch (err) {
        Swal.fire({
          title: 'Payout Failed',
          text: err.response?.data?.message || err.message,
          icon: 'error'
        });
        fetchData();
      } finally {
        setPayoutInProgressId(null);
      }
    }
  };

  // Handle Safe Batch Payout
  const handleBatchPayout = async () => {
    const readyPayrolls = payrolls.filter((p) => p.status === 'Ready_for_Payment');
    if (readyPayrolls.length === 0) {
      Swal.fire({ title: 'No Payrolls Ready', text: 'There are no payroll records currently in "Ready for Payment" status.', icon: 'info' });
      return;
    }

    const totalBatchAmount = readyPayrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);

    const confirm = await Swal.fire({
      title: `Execute Batch Payout (${readyPayrolls.length} Employees)?`,
      html: `
        <div style="text-align: left; font-size: 13px; line-height: 1.6;">
          <p><strong>Total Employees:</strong> ${readyPayrolls.length}</p>
          <p><strong>Total Net Amount:</strong> ₹${totalBatchAmount.toLocaleString('en-IN')}</p>
          <p><strong>Gateway Mode:</strong> ${gatewayInfo?.isRealApiConfigured ? 'RazorpayX' : 'RazorpayX Test Sandbox'}</p>
          <p style="color: #64748b; margin-top: 6px; font-size: 11px;">Each payout is executed independently with unique idempotency keys.</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: `Pay ₹${totalBatchAmount.toLocaleString('en-IN')}`,
      confirmButtonColor: '#4f46e5'
    });

    if (confirm.isConfirmed) {
      setLoading(true);
      try {
        const ids = readyPayrolls.map((p) => p._id);
        const res = await batchInitiatePayouts({ payrollIds: ids, transferMode: 'IMPS' });
        Swal.fire({
          title: 'Batch Complete',
          text: `Succeeded: ${res.data.successCount}, Failed: ${res.data.failedCount}`,
          icon: 'success'
        });
        fetchData();
      } catch (err) {
        Swal.fire({ title: 'Batch Payout Error', text: err.response?.data?.message || err.message, icon: 'error' });
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle Retry
  const handleRetry = async (payroll) => {
    try {
      setPayoutInProgressId(payroll._id);
      await retryPayout(payroll._id);
      Swal.fire({ title: 'Payout Retried', text: 'Payout attempt completed successfully.', icon: 'success' });
      fetchData();
    } catch (err) {
      Swal.fire({ title: 'Retry Failed', text: err.response?.data?.message || err.message, icon: 'error' });
      fetchData();
    } finally {
      setPayoutInProgressId(null);
    }
  };

  // Filtered Payrolls
  const filteredPayrolls = useMemo(() => {
    return payrolls.filter((p) => {
      if (activeTab === 'pending' && !['Pending_Manager_Review', 'Manager_Approved', 'Pending_Admin_Approval'].includes(p.status)) return false;
      if (activeTab === 'ready' && p.status !== 'Ready_for_Payment') return false;
      if (activeTab === 'paid' && p.status !== 'Paid') return false;
      if (activeTab === 'failed' && !['Failed', 'Admin_Rejected'].includes(p.status)) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = (p.employee?.name || '').toLowerCase();
        const id = (p.employee?.employeeId || '').toLowerCase();
        const dept = (p.department || '').toLowerCase();
        return name.includes(q) || id.includes(q) || dept.includes(q);
      }

      return true;
    });
  }, [payrolls, activeTab, searchQuery]);

  return (
    <div className="payroll-page-container">
      {/* 1. RazorpayX Gateway Banner */}
      <div className="razorpay-gateway-banner">
        <div className="gateway-banner-left">
          <div className="gateway-icon-badge">
            <Landmark size={20} />
          </div>
          <div>
            <div className="gateway-banner-title">
              <span>RazorpayX Payout Gateway</span>
              <span className="gateway-status-pill">
                <span className="pulse-dot" />
                {gatewayInfo?.isRealApiConfigured ? 'Live / Test API Connected' : 'Test Mode Sandbox Active'}
              </span>
            </div>
            <div className="gateway-banner-subtext">
              {gatewayInfo?.isRealApiConfigured
                ? `Account: ${gatewayInfo.accountNumberMasked} • Key: ${gatewayInfo.keyIdMasked}`
                : 'Zero-setup test sandbox ready. Instant payout simulation with genuine UTRs and bank account masking.'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowGatewayGuide(true)}
          className="btn-action-icon"
          style={{ width: 'auto', padding: '6px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' }}
        >
          <HelpCircle size={14} style={{ marginRight: '6px' }} />
          <span>RazorpayX Settings &amp; Guide</span>
        </button>
      </div>

      {/* 2. Page Header & Date / Actions */}
      <div className="payroll-header-row">
        <div className="payroll-header-info">
          <div className="payroll-title-icon-box">
            <CreditCard size={24} />
          </div>
          <div>
            <h1 className="payroll-main-title">Salary &amp; Payroll Management</h1>
            <p className="payroll-subtitle">
              Admin Operations Control • Configure structures, review attendance deductions, and execute RazorpayX payouts.
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="payroll-controls-bar">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="payroll-select"
          >
            {MONTH_NAMES.map((m, idx) => (
              <option key={idx} value={idx + 1}>{m}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="payroll-select"
          >
            {[2025, 2026, 2027].map((yr) => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="btn-generate-payroll"
          >
            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
            <span>Generate Payroll</span>
          </button>

          <button
            type="button"
            onClick={handleBatchPayout}
            disabled={loading || (kpis?.readyForPaymentCount || 0) === 0}
            className="btn-batch-payout"
            title="Execute payouts for all Ready for Payment records"
          >
            <Send size={14} />
            <span>Batch Payout ({kpis?.readyForPaymentCount || 0})</span>
          </button>
        </div>
      </div>

      {/* 3. KPI Cards Grid */}
      <div className="payroll-kpi-grid">
        <div className="payroll-kpi-card">
          <div className="kpi-header">
            <span>Total Net Payroll</span>
            <DollarSign size={16} color="#4f46e5" />
          </div>
          <div className="kpi-amount">
            ₹{Number(kpis?.totalNetAmount || 0).toLocaleString('en-IN')}
          </div>
          <div className="kpi-subtext">
            Gross Total: ₹{Number(kpis?.totalGrossAmount || 0).toLocaleString('en-IN')}
          </div>
        </div>

        <div className="payroll-kpi-card">
          <div className="kpi-header">
            <span>Ready for Payout</span>
            <CheckCircle size={16} color="#059669" />
          </div>
          <div className="kpi-amount emerald">
            {kpis?.readyForPaymentCount || 0}
          </div>
          <div className="kpi-subtext">
            Approved &amp; awaiting transfer
          </div>
        </div>

        <div className="payroll-kpi-card">
          <div className="kpi-header">
            <span>Pending Approvals</span>
            <Clock size={16} color="#d97706" />
          </div>
          <div className="kpi-amount amber">
            {(kpis?.pendingManagerCount || 0) + (kpis?.pendingAdminCount || 0)}
          </div>
          <div className="kpi-subtext">
            {kpis?.pendingManagerCount || 0} Manager • {kpis?.pendingAdminCount || 0} Admin
          </div>
        </div>

        <div className="payroll-kpi-card">
          <div className="kpi-header">
            <span>Paid / Disbursed</span>
            <Landmark size={16} color="#2563eb" />
          </div>
          <div className="kpi-amount blue">
            {kpis?.paidCount || 0}
          </div>
          <div className="kpi-subtext">
            {kpis?.failedCount || 0} Failed / Needs retry
          </div>
        </div>
      </div>

      {/* 4. Filter & Tabs Bar */}
      <div className="payroll-filter-bar">
        <div className="payroll-tabs">
          {[
            { id: 'all', label: 'All Payrolls', count: payrolls.length },
            { id: 'pending', label: 'Pending Approvals', count: (kpis?.pendingManagerCount || 0) + (kpis?.pendingAdminCount || 0) },
            { id: 'ready', label: 'Ready for Payment', count: kpis?.readyForPaymentCount || 0 },
            { id: 'paid', label: 'Paid Salaries', count: kpis?.paidCount || 0 },
            { id: 'failed', label: 'Failed / Needs Attention', count: kpis?.failedCount || 0 },
            { id: 'structures', label: 'Salary Structures' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`payroll-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="tab-badge">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {activeTab !== 'structures' && (
          <div className="payroll-search-input-wrap">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search by name, ID or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* 5. Main Content Area */}
      {activeTab === 'structures' ? (
        /* Salary Structures View */
        <div className="payroll-table-card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>
              Employee Salary Structures
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              Configure basic pay, standard allowances, statutory deductions, and banking details.
            </p>
          </div>

          <div className="payroll-table-wrapper">
            <table className="payroll-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Basic Salary</th>
                  <th>Allowances</th>
                  <th>Deductions</th>
                  <th>Bank Account</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {salaryStructures.map(({ employee, structure }) => {
                  const basic = structure?.basicSalary || 30000;
                  const totalAlw = (structure?.allowances || []).reduce((s, a) => s + (a.amount || 0), 0);
                  const totalDed = (structure?.deductions || []).reduce((s, d) => s + (d.amount || 0), 0);
                  const bankAcc = structure?.bankDetails?.accountNumber || '••••5678';

                  return (
                    <tr key={employee._id}>
                      <td>
                        <div className="emp-name-text">{employee.name}</div>
                        <div className="emp-sub-text">{employee.designation || 'Staff'} • {employee.department || 'General'}</div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '600' }}>
                        ₹{basic.toLocaleString('en-IN')}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: '#059669' }}>
                        +₹{totalAlw.toLocaleString('en-IN')}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: '#dc2626' }}>
                        -₹{totalDed.toLocaleString('en-IN')}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>
                        {bankAcc} ({structure?.bankDetails?.ifsc || 'HDFC0001234'})
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => setEditingStructure({ employee, structure })}
                          className="btn-action-primary"
                        >
                          <Edit3 size={12} />
                          <span>Configure</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Payroll Records Table */
        <div className="payroll-table-card">
          <div className="payroll-table-wrapper">
            <table className="payroll-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Attendance Verification</th>
                  <th>Gross Pay</th>
                  <th>Deductions</th>
                  <th>Net Salary</th>
                  <th>Workflow Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayrolls.map((payroll) => {
                  const emp = payroll.employee || {};
                  const att = payroll.attendanceSnapshot || {};
                  const isReady = payroll.status === 'Ready_for_Payment';
                  const isPaid = payroll.status === 'Paid';
                  const isFailed = payroll.status === 'Failed';
                  const isPendingAdmin = ['Manager_Approved', 'Pending_Admin_Approval'].includes(payroll.status);

                  return (
                    <tr key={payroll._id}>
                      <td>
                        <div className="emp-name-text">{emp.name || 'Employee'}</div>
                        <div className="emp-sub-text">
                          {emp.employeeId || 'ID: TF'} • {payroll.department || 'General'}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: '600', fontSize: '12px' }}>
                          {att.presentDays || 0} / {att.workingDays || 22} Days Present
                        </div>
                        <div className="emp-sub-text">
                          {att.approvedLeaves || 0} Leaves • {att.absentDays || 0} Absent
                        </div>
                      </td>

                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '600' }}>
                        ₹{Number(payroll.grossSalary || 0).toLocaleString('en-IN')}
                      </td>

                      <td style={{ fontFamily: 'var(--font-mono)', color: '#dc2626', fontWeight: '600' }}>
                        -₹{Number(payroll.totalDeductions || 0).toLocaleString('en-IN')}
                      </td>

                      <td style={{ fontFamily: 'var(--font-mono)', color: '#4f46e5', fontWeight: '800', fontSize: '14px' }}>
                        ₹{Number(payroll.netSalary || 0).toLocaleString('en-IN')}
                      </td>

                      <td>
                        <span className={`payroll-badge ${
                          isPaid ? 'status-paid' : isReady ? 'status-ready' : isFailed ? 'status-failed' : 'status-pending'
                        }`}>
                          <span className="pulse-dot" style={{
                            background: isPaid ? '#10b981' : isReady ? '#4f46e5' : isFailed ? '#ef4444' : '#f59e0b',
                            width: '6px', height: '6px', borderRadius: '50%'
                          }} />
                          {payroll.status.replace(/_/g, ' ')}
                        </span>
                        {payroll.payout?.utr && (
                          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--muted)', marginTop: '4px' }}>
                            UTR: {payroll.payout.utr}
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div className="payroll-actions-group">
                          {/* Admin Approval Actions */}
                          {isPendingAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleAdminReview(payroll, 'approved')}
                                className="btn-action-success"
                                title="Approve for Payment"
                              >
                                <Check size={12} />
                                <span>Approve</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdminReview(payroll, 'rejected')}
                                className="btn-action-danger"
                                title="Reject / Request Correction"
                              >
                                <X size={12} />
                              </button>
                            </>
                          )}

                          {/* Initiate Payout Action */}
                          {isReady && (
                            <button
                              type="button"
                              onClick={() => handleInitiatePayout(payroll)}
                              disabled={payoutInProgressId === payroll._id}
                              className="btn-action-primary"
                            >
                              <Send size={12} />
                              <span>{payoutInProgressId === payroll._id ? 'Transferring...' : 'Pay Salary'}</span>
                            </button>
                          )}

                          {/* Retry Failed Payout */}
                          {isFailed && (
                            <button
                              type="button"
                              onClick={() => handleRetry(payroll)}
                              disabled={payoutInProgressId === payroll._id}
                              className="btn-action-primary"
                              style={{ background: '#d97706' }}
                              title="Safe Retry Payout"
                            >
                              <RefreshCw size={12} />
                              <span>Retry</span>
                            </button>
                          )}

                          {/* Recalculate prior to payment */}
                          {!isPaid && !isReady && (
                            <button
                              type="button"
                              onClick={() => handleRecalculate(payroll)}
                              className="btn-action-icon"
                              title="Recalculate attendance & leaves"
                            >
                              <RefreshCw size={14} />
                            </button>
                          )}

                          {/* View Payslip */}
                          <button
                            type="button"
                            onClick={() => setSelectedPayslipPayroll(payroll)}
                            className="btn-action-icon"
                            title="View / Print Official Payslip"
                          >
                            <Eye size={14} color="#4f46e5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredPayrolls.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="payroll-empty-state">
                        <CreditCard size={32} />
                        <h3>No payroll records found</h3>
                        <p>Click "Generate Payroll" above to compute salaries for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payslip Modal */}
      {selectedPayslipPayroll && (
        <PayslipModal
          payroll={selectedPayslipPayroll}
          onClose={() => setSelectedPayslipPayroll(null)}
        />
      )}

      {/* Gateway Guide Modal */}
      {showGatewayGuide && (
        <div className="payroll-modal-backdrop" onClick={() => setShowGatewayGuide(false)}>
          <div className="payroll-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="payroll-modal-header">
              <h3 className="payroll-modal-title">
                <Landmark size={18} color="#4f46e5" />
                <span>RazorpayX Payouts Configuration</span>
              </h3>
              <button type="button" onClick={() => setShowGatewayGuide(false)} className="btn-action-icon">
                <X size={16} />
              </button>
            </div>

            <div className="payroll-modal-body">
              <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(79, 70, 229, 0.08)', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
                <p style={{ fontWeight: '700', color: '#4f46e5', margin: '0 0 6px' }}>Test Mode Sandbox Simulator Active</p>
                <p style={{ fontSize: '12px', color: 'var(--text)', margin: 0, lineHeight: '1.5' }}>
                  You do not need to register on Razorpay to test this feature! The built-in simulator automatically handles Contacts, Fund Accounts, Payout IDs, and authentic Indian banking UTRs (e.g. UTR261119...).
                </p>
              </div>

              <div>
                <h4 style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: '700' }}>How to connect your Real RazorpayX Account:</h4>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
                  When you are ready to use real bank payouts in test or live mode, add these keys to your backend <code>.env</code> file:
                </p>
                <pre style={{
                  background: '#0f172a', color: '#34d399', padding: '12px', borderRadius: '10px',
                  fontFamily: 'var(--font-mono)', fontSize: '11px', marginTop: '8px', overflowX: 'auto'
                }}>
{`RAZORPAYX_KEY_ID=rzp_test_your_key_id
RAZORPAYX_KEY_SECRET=your_key_secret
RAZORPAYX_ACCOUNT_NUMBER=2323230041234567
RAZORPAYX_WEBHOOK_SECRET=your_webhook_secret`}
                </pre>
              </div>

              <div>
                <h4 style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: '700' }}>Outbound Payout Purpose &amp; Mode:</h4>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)', lineHeight: '1.5' }}>
                  All salary transfers use purpose <code>salary</code> with instant transfer mode (<code>IMPS</code> / <code>NEFT</code> / <code>UPI</code>) and full idempotency protection against double charges.
                </p>
              </div>
            </div>

            <div className="payroll-modal-footer">
              <button
                type="button"
                onClick={() => setShowGatewayGuide(false)}
                className="btn-action-primary"
                style={{ padding: '8px 20px' }}
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Salary Structure Edit Modal */}
      {editingStructure && (
        <SalaryStructureModal
          data={editingStructure}
          onClose={() => setEditingStructure(null)}
          onSaved={() => {
            setEditingStructure(null);
            fetchStructures();
          }}
        />
      )}
    </div>
  );
}

/**
 * Salary Structure Editor Drawer / Modal
 */
function SalaryStructureModal({ data, onClose, onSaved }) {
  const { employee, structure } = data;
  const [basicSalary, setBasicSalary] = useState(structure?.basicSalary || 35000);
  const [allowances, setAllowances] = useState(structure?.allowances || [
    { name: 'House Rent Allowance (HRA)', amount: 14000 },
    { name: 'Special Allowance', amount: 5000 },
    { name: 'Conveyance Allowance', amount: 2000 }
  ]);
  const [bonus, setBonus] = useState(structure?.bonus || 0);
  const [deductions, setDeductions] = useState(structure?.deductions || [
    { name: 'Provident Fund (PF)', amount: 1800, type: 'fixed' },
    { name: 'Professional Tax (PT)', amount: 200, type: 'fixed' }
  ]);
  const [bankDetails, setBankDetails] = useState(structure?.bankDetails || {
    accountHolderName: employee.name,
    accountNumber: '112233445566',
    ifsc: 'HDFC0001234',
    bankName: 'HDFC Bank',
    upiId: `${employee.name.toLowerCase().replace(/\s+/g, '')}@okaxis`
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await upsertSalaryStructure({
        employeeId: employee._id,
        basicSalary,
        allowances,
        bonus,
        deductions,
        bankDetails
      });
      Swal.fire({ title: 'Saved!', text: 'Salary structure updated successfully.', icon: 'success', timer: 1500, showConfirmButton: false });
      onSaved();
    } catch (err) {
      Swal.fire({ title: 'Failed to Save', text: err.response?.data?.message || err.message, icon: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="payroll-modal-backdrop" onClick={onClose}>
      <div className="payroll-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="payroll-modal-header">
          <div>
            <h3 className="payroll-modal-title">Configure Salary Structure</h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              Employee: {employee.name} ({employee.employeeId || 'TF-EMP'})
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-action-icon">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="payroll-modal-body">
            {/* Basic Pay & Bonus */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '12px' }}>Monthly Basic Salary (₹)</label>
                <input
                  type="number"
                  value={basicSalary}
                  onChange={(e) => setBasicSalary(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '12px' }}>Performance Bonus / Incentive (₹)</label>
                <input
                  type="number"
                  value={bonus}
                  onChange={(e) => setBonus(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>

            {/* Allowances */}
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '12px' }}>Monthly Allowances</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {allowances.map((alw, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={alw.name}
                      onChange={(e) => {
                        const copy = [...allowances];
                        copy[idx].name = e.target.value;
                        setAllowances(copy);
                      }}
                      placeholder="Allowance name (e.g. HRA)"
                      style={{ flex: 1, padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                    />
                    <input
                      type="number"
                      value={alw.amount}
                      onChange={(e) => {
                        const copy = [...allowances];
                        copy[idx].amount = Number(e.target.value);
                        setAllowances(copy);
                      }}
                      placeholder="Amount"
                      style={{ width: '130px', padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setAllowances(allowances.filter((_, i) => i !== idx))}
                      className="btn-action-icon"
                      style={{ color: '#dc2626' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setAllowances([...allowances, { name: 'Special Allowance', amount: 3000 }])}
                  style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#4f46e5', fontWeight: '600', fontSize: '12px', cursor: 'pointer', padding: '4px 0' }}
                >
                  + Add Allowance
                </button>
              </div>
            </div>

            {/* Deductions */}
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '12px' }}>Standard Monthly Deductions</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {deductions.map((ded, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={ded.name}
                      onChange={(e) => {
                        const copy = [...deductions];
                        copy[idx].name = e.target.value;
                        setDeductions(copy);
                      }}
                      placeholder="Deduction name (e.g. PF, TDS)"
                      style={{ flex: 1, padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                    />
                    <input
                      type="number"
                      value={ded.amount}
                      onChange={(e) => {
                        const copy = [...deductions];
                        copy[idx].amount = Number(e.target.value);
                        setDeductions(copy);
                      }}
                      placeholder="Amount"
                      style={{ width: '130px', padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: '#dc2626', fontFamily: 'var(--font-mono)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setDeductions(deductions.filter((_, i) => i !== idx))}
                      className="btn-action-icon"
                      style={{ color: '#dc2626' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setDeductions([...deductions, { name: 'Health Insurance', amount: 500, type: 'fixed' }])}
                  style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#dc2626', fontWeight: '600', fontSize: '12px', cursor: 'pointer', padding: '4px 0' }}
                >
                  + Add Deduction
                </button>
              </div>
            </div>

            {/* Bank Details */}
            <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <span style={{ display: 'block', fontWeight: '700', fontSize: '13px', marginBottom: '12px' }}>
                Disbursement Bank &amp; UPI Information
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Bank Account Number</label>
                  <input
                    type="text"
                    value={bankDetails.accountNumber || ''}
                    onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                    style={{ width: '100%', padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>IFSC Code</label>
                  <input
                    type="text"
                    value={bankDetails.ifsc || ''}
                    onChange={(e) => setBankDetails({ ...bankDetails, ifsc: e.target.value.toUpperCase() })}
                    style={{ width: '100%', padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Bank Name</label>
                  <input
                    type="text"
                    value={bankDetails.bankName || ''}
                    onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                    style={{ width: '100%', padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>UPI ID (Optional)</label>
                  <input
                    type="text"
                    value={bankDetails.upiId || ''}
                    onChange={(e) => setBankDetails({ ...bankDetails, upiId: e.target.value })}
                    style={{ width: '100%', padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="payroll-modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="btn-action-icon"
              style={{ width: 'auto', padding: '8px 16px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-action-primary"
              style={{ padding: '8px 20px' }}
            >
              {saving ? 'Saving...' : 'Save Structure'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
