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
      // Tab filter
      if (activeTab === 'pending' && !['Pending_Manager_Review', 'Manager_Approved', 'Pending_Admin_Approval'].includes(p.status)) return false;
      if (activeTab === 'ready' && p.status !== 'Ready_for_Payment') return false;
      if (activeTab === 'paid' && p.status !== 'Paid') return false;
      if (activeTab === 'failed' && !['Failed', 'Admin_Rejected'].includes(p.status)) return false;

      // Search filter
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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner: RazorpayX Test Mode Status */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-gradient-to-r from-indigo-50/80 via-white to-blue-50/60 dark:from-slate-900 dark:via-slate-800/80 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-[var(--text,#0f172a)]">
                RazorpayX Payout Gateway
              </h3>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {gatewayInfo?.isRealApiConfigured ? 'Live / Test API Connected' : 'Test Mode Sandbox Active'}
              </span>
            </div>
            <p className="text-xs text-[var(--muted,#64748b)] mt-0.5">
              {gatewayInfo?.isRealApiConfigured
                ? `Account: ${gatewayInfo.accountNumberMasked} • Key: ${gatewayInfo.keyIdMasked}`
                : 'Zero-setup test sandbox ready. Instant payout simulation with genuine UTRs and bank account masking.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowGatewayGuide(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-xl shadow-xs hover:bg-indigo-50/50 dark:hover:bg-slate-700 transition-all cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>RazorpayX Settings & Guide</span>
        </button>
      </div>

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text,#0f172a)]">
            Salary & Payroll Management
          </h1>
          <p className="text-xs text-[var(--muted,#64748b)] mt-0.5">
            Admin Operations Control • Configure structures, review attendance deductions, and execute RazorpayX payouts.
          </p>
        </div>

        {/* Month Selector & Main Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month Selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 text-xs font-medium rounded-xl border border-[var(--border,#e2e8f0)] bg-[var(--surface,#ffffff)] text-[var(--text,#0f172a)] shadow-xs focus:ring-2 focus:ring-indigo-500"
          >
            {MONTH_NAMES.map((m, idx) => (
              <option key={idx} value={idx + 1}>{m}</option>
            ))}
          </select>

          {/* Year Selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 text-xs font-medium rounded-xl border border-[var(--border,#e2e8f0)] bg-[var(--surface,#ffffff)] text-[var(--text,#0f172a)] shadow-xs focus:ring-2 focus:ring-indigo-500"
          >
            {[2025, 2026, 2027].map((yr) => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>

          {/* Generate Payroll Button */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Generate Payroll</span>
          </button>

          {/* Batch Payout Button */}
          <button
            onClick={handleBatchPayout}
            disabled={loading || (kpis?.readyForPaymentCount || 0) === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
            title="Execute payouts for all Ready for Payment records"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Batch Payout ({kpis?.readyForPaymentCount || 0})</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[var(--surface,#ffffff)] border border-[var(--border,#e2e8f0)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--muted,#64748b)]">
            <span>Total Net Payroll</span>
            <DollarSign className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-[var(--text,#0f172a)]">
            ₹{Number(kpis?.totalNetAmount || 0).toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-[11px] text-[var(--muted,#64748b)]">
            Gross: ₹{Number(kpis?.totalGrossAmount || 0).toLocaleString('en-IN')}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface,#ffffff)] border border-[var(--border,#e2e8f0)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--muted,#64748b)]">
            <span>Ready for Payout</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-600">
            {kpis?.readyForPaymentCount || 0}
          </div>
          <div className="mt-1 text-[11px] text-[var(--muted,#64748b)]">
            Approved & awaiting transfer
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface,#ffffff)] border border-[var(--border,#e2e8f0)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--muted,#64748b)]">
            <span>Pending Approvals</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-xl font-bold text-amber-600">
            {(kpis?.pendingManagerCount || 0) + (kpis?.pendingAdminCount || 0)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--muted,#64748b)]">
            {kpis?.pendingManagerCount || 0} Manager • {kpis?.pendingAdminCount || 0} Admin
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface,#ffffff)] border border-[var(--border,#e2e8f0)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--muted,#64748b)]">
            <span>Paid / Disbursed</span>
            <Landmark className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-xl font-bold text-blue-600">
            {kpis?.paidCount || 0}
          </div>
          <div className="mt-1 text-[11px] text-[var(--muted,#64748b)]">
            {kpis?.failedCount || 0} Failed / Needs retry
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border,#e2e8f0)] pb-3">
        <div className="flex flex-wrap items-center gap-2">
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
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-[var(--muted,#64748b)] hover:text-[var(--text,#0f172a)] hover:bg-[var(--panel,#f8fafc)]'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === tab.id ? 'bg-indigo-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab !== 'structures' && (
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--muted,#94a3b8)]" />
            <input
              type="text"
              placeholder="Filter by name, ID or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[var(--border,#e2e8f0)] bg-[var(--surface,#ffffff)] text-[var(--text,#0f172a)] focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'structures' ? (
        /* Salary Structures View */
        <div className="bg-[var(--surface,#ffffff)] border border-[var(--border,#e2e8f0)] rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[var(--border,#e2e8f0)] flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm text-[var(--text,#0f172a)]">
                Employee Salary Structures
              </h3>
              <p className="text-xs text-[var(--muted,#64748b)]">
                Configure basic pay, standard allowances, statutory deductions, and banking details.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--panel,#f8fafc)] text-[var(--muted,#64748b)] font-semibold border-b border-[var(--border,#e2e8f0)]">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Basic Salary</th>
                  <th className="py-3 px-4">Allowances</th>
                  <th className="py-3 px-4">Deductions</th>
                  <th className="py-3 px-4">Bank Account</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border,#e2e8f0)]">
                {salaryStructures.map(({ employee, structure }) => {
                  const basic = structure?.basicSalary || 30000;
                  const totalAlw = (structure?.allowances || []).reduce((s, a) => s + (a.amount || 0), 0);
                  const totalDed = (structure?.deductions || []).reduce((s, d) => s + (d.amount || 0), 0);
                  const bankAcc = structure?.bankDetails?.accountNumber || '••••5678';

                  return (
                    <tr key={employee._id} className="hover:bg-[var(--panel,#f8fafc)]/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[var(--text,#0f172a)]">{employee.name}</div>
                        <div className="text-[11px] text-[var(--muted,#64748b)]">{employee.designation || 'Staff'} • {employee.department || 'General'}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-[var(--text,#0f172a)]">
                        ₹{basic.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-600">
                        +₹{totalAlw.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 font-mono text-rose-600">
                        -₹{totalDed.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 font-mono text-[var(--muted,#64748b)]">
                        {bankAcc} ({structure?.bankDetails?.ifsc || 'HDFC0001234'})
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setEditingStructure({ employee, structure })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
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
        /* Payroll Table View */
        <div className="bg-[var(--surface,#ffffff)] border border-[var(--border,#e2e8f0)] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--panel,#f8fafc)] text-[var(--muted,#64748b)] font-semibold border-b border-[var(--border,#e2e8f0)]">
                <tr>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Attendance</th>
                  <th className="py-3.5 px-4">Gross Pay</th>
                  <th className="py-3.5 px-4">Deductions</th>
                  <th className="py-3.5 px-4">Net Salary</th>
                  <th className="py-3.5 px-4">Workflow Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border,#e2e8f0)]">
                {filteredPayrolls.map((payroll) => {
                  const emp = payroll.employee || {};
                  const att = payroll.attendanceSnapshot || {};
                  const isReady = payroll.status === 'Ready_for_Payment';
                  const isPaid = payroll.status === 'Paid';
                  const isFailed = payroll.status === 'Failed';
                  const isPendingAdmin = ['Manager_Approved', 'Pending_Admin_Approval'].includes(payroll.status);

                  return (
                    <tr key={payroll._id} className="hover:bg-[var(--panel,#f8fafc)]/50 transition-colors">
                      {/* Employee Column */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[var(--text,#0f172a)] text-sm">{emp.name || 'Employee'}</div>
                        <div className="text-[11px] text-[var(--muted,#64748b)] mt-0.5">
                          {emp.employeeId || 'ID: TF'} • {payroll.department || 'General'}
                        </div>
                      </td>

                      {/* Attendance Snapshot */}
                      <td className="py-3.5 px-4 text-[11px]">
                        <div className="text-[var(--text,#0f172a)] font-medium">
                          {att.presentDays || 0} / {att.workingDays || 22} Days Present
                        </div>
                        <div className="text-[var(--muted,#64748b)] mt-0.5">
                          {att.approvedLeaves || 0} Leaves • {att.absentDays || 0} Absent
                        </div>
                      </td>

                      {/* Gross Pay */}
                      <td className="py-3.5 px-4 font-mono font-medium text-[var(--text,#0f172a)]">
                        ₹{Number(payroll.grossSalary || 0).toLocaleString('en-IN')}
                      </td>

                      {/* Deductions */}
                      <td className="py-3.5 px-4 font-mono text-rose-600">
                        -₹{Number(payroll.totalDeductions || 0).toLocaleString('en-IN')}
                      </td>

                      {/* Net Salary */}
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 text-sm">
                        ₹{Number(payroll.netSalary || 0).toLocaleString('en-IN')}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          isPaid
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : isReady
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse'
                            : isFailed
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : isPendingAdmin
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isPaid ? 'bg-emerald-500' : isReady ? 'bg-indigo-500' : isFailed ? 'bg-rose-500' : 'bg-amber-500'
                          }`} />
                          {payroll.status.replace(/_/g, ' ')}
                        </span>
                        {payroll.payout?.utr && (
                          <div className="text-[10px] font-mono text-[var(--muted,#64748b)] mt-1">
                            UTR: {payroll.payout.utr}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Admin Approval Buttons */}
                          {isPendingAdmin && (
                            <>
                              <button
                                onClick={() => handleAdminReview(payroll, 'approved')}
                                className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1"
                                title="Approve for Payment"
                              >
                                <Check className="w-3 h-3" />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => handleAdminReview(payroll, 'rejected')}
                                className="px-2 py-1 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all cursor-pointer"
                                title="Reject / Request Correction"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </>
                          )}

                          {/* Initiate Payout Button */}
                          {isReady && (
                            <button
                              onClick={() => handleInitiatePayout(payroll)}
                              disabled={payoutInProgressId === payroll._id}
                              className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1"
                            >
                              <Send className="w-3 h-3" />
                              <span>{payoutInProgressId === payroll._id ? 'Transferring...' : 'Pay Salary'}</span>
                            </button>
                          )}

                          {/* Retry Failed Payout */}
                          {isFailed && (
                            <button
                              onClick={() => handleRetry(payroll)}
                              disabled={payoutInProgressId === payroll._id}
                              className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                              title="Safe Retry Payout"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Retry</span>
                            </button>
                          )}

                          {/* Recalculate prior to payment */}
                          {!isPaid && !isReady && (
                            <button
                              onClick={() => handleRecalculate(payroll)}
                              className="p-1.5 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Recalculate attendance & leaves"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* View Payslip */}
                          <button
                            onClick={() => setSelectedPayslipPayroll(payroll)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="View / Print Official Payslip"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredPayrolls.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[var(--muted,#64748b)]">
                      <CreditCard className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-sm text-[var(--text,#0f172a)]">No payroll records found</p>
                      <p className="text-xs mt-1">Click "Generate Payroll" above to compute salaries for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl bg-[var(--surface,#ffffff)] border border-[var(--border,#e2e8f0)] rounded-2xl p-6 shadow-2xl space-y-4 text-[var(--text,#0f172a)]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border,#e2e8f0)]">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-base">RazorpayX Payouts Configuration</h3>
              </div>
              <button onClick={() => setShowGatewayGuide(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-[var(--muted,#64748b)]">
              <div className="p-3 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-xl text-indigo-900 dark:text-indigo-200">
                <p className="font-semibold">Test Mode Sandbox Simulator Active</p>
                <p className="mt-1 text-[11px]">
                  You do not need to register on Razorpay to test this feature! The built-in simulator automatically handles Contacts, Fund Accounts, Payout IDs, and authentic Indian banking UTRs (e.g. UTR261119...).
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-[var(--text,#0f172a)] mb-1">How to connect your Real RazorpayX Account:</h4>
                <p>When you are ready to use real bank payouts in test or live mode, add these keys to your backend <code>.env</code> file:</p>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto mt-2">
{`RAZORPAYX_KEY_ID=rzp_test_your_key_id
RAZORPAYX_KEY_SECRET=your_key_secret
RAZORPAYX_ACCOUNT_NUMBER=2323230041234567
RAZORPAYX_WEBHOOK_SECRET=your_webhook_secret`}
                </pre>
              </div>

              <div>
                <h4 className="font-semibold text-[var(--text,#0f172a)] mb-1">Outbound Payout Purpose & Mode:</h4>
                <p>All salary transfers use purpose <code>salary</code> with instant transfer mode (<code>IMPS</code> / <code>NEFT</code> / <code>UPI</code>) and full idempotency protection against double charges.</p>
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--border,#e2e8f0)] flex justify-end">
              <button
                onClick={() => setShowGatewayGuide(false)}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--surface,#ffffff)] border border-[var(--border,#e2e8f0)] rounded-2xl p-6 shadow-2xl space-y-5 text-[var(--text,#0f172a)]">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border,#e2e8f0)]">
          <div>
            <h3 className="font-bold text-base">Configure Salary Structure</h3>
            <p className="text-xs text-[var(--muted,#64748b)]">Employee: {employee.name} ({employee.employeeId || 'TF-EMP'})</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Basic Pay & Bonus */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold block mb-1">Monthly Basic Salary (₹)</label>
              <input
                type="number"
                value={basicSalary}
                onChange={(e) => setBasicSalary(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border,#e2e8f0)] bg-[var(--panel,#f8fafc)] font-mono"
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Performance Bonus / Incentive (₹)</label>
              <input
                type="number"
                value={bonus}
                onChange={(e) => setBonus(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border,#e2e8f0)] bg-[var(--panel,#f8fafc)] font-mono"
              />
            </div>
          </div>

          {/* Allowances */}
          <div>
            <label className="font-semibold block mb-1.5">Monthly Allowances</label>
            <div className="space-y-2">
              {allowances.map((alw, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={alw.name}
                    onChange={(e) => {
                      const copy = [...allowances];
                      copy[idx].name = e.target.value;
                      setAllowances(copy);
                    }}
                    placeholder="Allowance name (e.g. HRA)"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--border,#e2e8f0)] bg-[var(--panel,#f8fafc)]"
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
                    className="w-32 px-3 py-1.5 rounded-lg border border-[var(--border,#e2e8f0)] bg-[var(--panel,#f8fafc)] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setAllowances(allowances.filter((_, i) => i !== idx))}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setAllowances([...allowances, { name: 'Special Allowance', amount: 3000 }])}
                className="text-xs text-indigo-600 font-medium hover:underline mt-1"
              >
                + Add Allowance
              </button>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <label className="font-semibold block mb-1.5">Standard Monthly Deductions</label>
            <div className="space-y-2">
              {deductions.map((ded, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={ded.name}
                    onChange={(e) => {
                      const copy = [...deductions];
                      copy[idx].name = e.target.value;
                      setDeductions(copy);
                    }}
                    placeholder="Deduction name (e.g. PF, TDS)"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--border,#e2e8f0)] bg-[var(--panel,#f8fafc)]"
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
                    className="w-32 px-3 py-1.5 rounded-lg border border-[var(--border,#e2e8f0)] bg-[var(--panel,#f8fafc)] font-mono text-rose-600"
                  />
                  <button
                    type="button"
                    onClick={() => setDeductions(deductions.filter((_, i) => i !== idx))}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setDeductions([...deductions, { name: 'Health Insurance', amount: 500, type: 'fixed' }])}
                className="text-xs text-rose-600 font-medium hover:underline mt-1"
              >
                + Add Deduction
              </button>
            </div>
          </div>

          {/* Bank Details */}
          <div className="p-4 bg-[var(--panel,#f8fafc)] border border-[var(--border,#e2e8f0)] rounded-xl space-y-3">
            <span className="font-semibold text-slate-800 dark:text-slate-200 block">
              Disbursement Bank & UPI Information
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-[var(--muted,#64748b)] block">Bank Account Number</label>
                <input
                  type="text"
                  value={bankDetails.accountNumber || ''}
                  onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border,#e2e8f0)] font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--muted,#64748b)] block">IFSC Code</label>
                <input
                  type="text"
                  value={bankDetails.ifsc || ''}
                  onChange={(e) => setBankDetails({ ...bankDetails, ifsc: e.target.value.toUpperCase() })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border,#e2e8f0)] font-mono uppercase"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--muted,#64748b)] block">Bank Name</label>
                <input
                  type="text"
                  value={bankDetails.bankName || ''}
                  onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border,#e2e8f0)]"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--muted,#64748b)] block">UPI ID (Optional)</label>
                <input
                  type="text"
                  value={bankDetails.upiId || ''}
                  onChange={(e) => setBankDetails({ ...bankDetails, upiId: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border,#e2e8f0)]"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--border,#e2e8f0)] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Structure'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
