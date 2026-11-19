import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  CheckCircle,
  AlertCircle,
  Clock,
  Eye,
  Check,
  X,
  Search
} from 'lucide-react';
import { getTeamPayrolls, managerReviewPayroll, managerBulkApprove } from '../../api/payrollApi';
import PayslipModal from './PayslipModal';
import Swal from '../../utils/swalConfig';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function ManagerPayrollReview({ user }) {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [loading, setLoading] = useState(false);
  const [teamPayrolls, setTeamPayrolls] = useState([]);
  const [teamOverview, setTeamOverview] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayslipPayroll, setSelectedPayslipPayroll] = useState(null);

  const fetchTeamData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTeamPayrolls({
        month: selectedMonth,
        year: selectedYear
      });
      setTeamPayrolls(res.data.data || []);
      setTeamOverview(res.data.teamOverview || null);
    } catch (err) {
      console.error('Failed to load team payrolls:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  // Single Member Review (Approve or Request Correction)
  const handleReview = async (payroll, decision) => {
    const isApprove = decision === 'approved';
    const { value: remarks } = await Swal.fire({
      title: isApprove ? 'Approve Team Member Payroll?' : 'Request Correction?',
      text: isApprove
        ? `Forward ${payroll.employee?.name}'s payroll to Admin for final verification and payout.`
        : `Please state the correction needed (e.g., attendance discrepancy, leave adjustment):`,
      input: isApprove ? undefined : 'textarea',
      inputPlaceholder: 'Enter review notes...',
      icon: isApprove ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonText: isApprove ? 'Confirm Approval' : 'Send Correction Request',
      confirmButtonColor: isApprove ? '#10b981' : '#f59e0b'
    });

    if (isApprove || remarks !== undefined) {
      try {
        await managerReviewPayroll(payroll._id, {
          decision,
          remarks: remarks || (isApprove ? 'Verified attendance and team deliverables.' : '')
        });
        Swal.fire({
          title: isApprove ? 'Approved' : 'Correction Requested',
          text: isApprove ? 'Payroll verified and sent to Admin.' : 'Sent back for correction.',
          icon: isApprove ? 'success' : 'info',
          timer: 1500,
          showConfirmButton: false
        });
        fetchTeamData();
      } catch (err) {
        Swal.fire({ title: 'Action Failed', text: err.response?.data?.message || err.message, icon: 'error' });
      }
    }
  };

  // Bulk Approve Entire Team
  const handleBulkApprove = async () => {
    const pendingList = teamPayrolls.filter((p) => p.status === 'Pending_Manager_Review');
    if (pendingList.length === 0) {
      Swal.fire({ title: 'No Pending Payrolls', text: 'All team payrolls are already reviewed.', icon: 'info' });
      return;
    }

    const totalTeamNet = pendingList.reduce((sum, p) => sum + (p.netSalary || 0), 0);

    const result = await Swal.fire({
      title: `Approve All ${pendingList.length} Team Members?`,
      html: `
        <div style="text-align: left; font-size: 13px; line-height: 1.6;">
          <p><strong>Department / Team:</strong> ${teamOverview?.department || 'Operations'}</p>
          <p><strong>Members to Approve:</strong> ${pendingList.length}</p>
          <p><strong>Total Team Net Pay:</strong> ₹${totalTeamNet.toLocaleString('en-IN')}</p>
          <p style="margin-top: 8px; color: #64748b;">Confirming validates that attendance logs and deliverables have been inspected.</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Approve All Team Payrolls',
      confirmButtonColor: '#10b981'
    });

    if (result.isConfirmed) {
      try {
        await managerBulkApprove({
          month: selectedMonth,
          year: selectedYear,
          remarks: `Bulk approved by manager ${user?.name} on ${new Date().toLocaleDateString()}`
        });
        Swal.fire({ title: 'Team Payroll Approved!', text: 'All records forwarded to Admin.', icon: 'success' });
        fetchTeamData();
      } catch (err) {
        Swal.fire({ title: 'Bulk Approval Failed', text: err.response?.data?.message || err.message, icon: 'error' });
      }
    }
  };

  const filtered = teamPayrolls.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = (p.employee?.name || '').toLowerCase();
    const id = (p.employee?.employeeId || '').toLowerCase();
    return name.includes(q) || id.includes(q);
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text,#0f172a)]">
            Team Payroll & Attendance Review
          </h1>
          <p className="text-xs text-[var(--muted,#64748b)] mt-0.5">
            Manager Review Portal • Verify employee attendance snapshots, approved leaves, and net payable before Admin payout.
          </p>
        </div>

        {/* Month Selector & Bulk Approve */}
        <div className="flex items-center gap-2.5">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 text-xs font-medium rounded-xl border border-[var(--border,#e2e8f0)] bg-[var(--surface,#ffffff)] text-[var(--text,#0f172a)] shadow-xs"
          >
            {MONTH_NAMES.map((m, idx) => (
              <option key={idx} value={idx + 1}>{m}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 text-xs font-medium rounded-xl border border-[var(--border,#e2e8f0)] bg-[var(--surface,#ffffff)] text-[var(--text,#0f172a)] shadow-xs"
          >
            {[2025, 2026, 2027].map((yr) => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>

          <button
            onClick={handleBulkApprove}
            disabled={loading || (teamOverview?.pendingReviewCount || 0) === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Approve Team ({teamOverview?.pendingReviewCount || 0})</span>
          </button>
        </div>
      </div>

      {/* Team Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[var(--surface,#ffffff)] border border-[var(--border,#e2e8f0)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--muted,#64748b)]">
            <span>Assigned Team Members</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-xl font-bold text-[var(--text,#0f172a)]">
            {teamOverview?.totalTeamMembers || 0}
          </div>
          <div className="mt-1 text-[11px] text-[var(--muted,#64748b)]">
            {teamOverview?.department || 'Operations Team'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface,#ffffff)] border border-[var(--border,#e2e8f0)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--muted,#64748b)]">
            <span>Pending Review</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-xl font-bold text-amber-600">
            {teamOverview?.pendingReviewCount || 0}
          </div>
          <div className="mt-1 text-[11px] text-[var(--muted,#64748b)]">
            Requires manager review
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface,#ffffff)] border border-[var(--border,#e2e8f0)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--muted,#64748b)]">
            <span>Manager Approved</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-600">
            {teamOverview?.approvedCount || 0}
          </div>
          <div className="mt-1 text-[11px] text-[var(--muted,#64748b)]">
            Forwarded to Admin
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface,#ffffff)] border border-[var(--border,#e2e8f0)] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--muted,#64748b)]">
            <span>Corrections Requested</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-xl font-bold text-rose-600">
            {teamOverview?.correctionCount || 0}
          </div>
          <div className="mt-1 text-[11px] text-[var(--muted,#64748b)]">
            Returned for adjustment
          </div>
        </div>
      </div>

      {/* Team Payroll Table */}
      <div className="bg-[var(--surface,#ffffff)] border border-[var(--border,#e2e8f0)] rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[var(--border,#e2e8f0)] flex items-center justify-between">
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--muted,#94a3b8)]" />
            <input
              type="text"
              placeholder="Search team member by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[var(--border,#e2e8f0)] bg-[var(--panel,#f8fafc)] text-[var(--text,#0f172a)] focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--panel,#f8fafc)] text-[var(--muted,#64748b)] font-semibold border-b border-[var(--border,#e2e8f0)]">
              <tr>
                <th className="py-3.5 px-4">Member Name</th>
                <th className="py-3.5 px-4">Attendance Verification</th>
                <th className="py-3.5 px-4">Gross Earnings</th>
                <th className="py-3.5 px-4">Absence / Deductions</th>
                <th className="py-3.5 px-4">Net Salary</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Review Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border,#e2e8f0)]">
              {filtered.map((payroll) => {
                const emp = payroll.employee || {};
                const att = payroll.attendanceSnapshot || {};
                const isPending = payroll.status === 'Pending_Manager_Review';
                const isApproved = ['Manager_Approved', 'Ready_for_Payment', 'Paid'].includes(payroll.status);

                return (
                  <tr key={payroll._id} className="hover:bg-[var(--panel,#f8fafc)]/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[var(--text,#0f172a)] text-sm">{emp.name}</div>
                      <div className="text-[11px] text-[var(--muted,#64748b)]">
                        {emp.employeeId || 'TF-EMP'} • {emp.designation || 'Specialist'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-[11px]">
                      <div className="text-[var(--text,#0f172a)] font-medium">
                        {att.presentDays || 0} / {att.workingDays || 22} Present
                      </div>
                      <div className="text-[var(--muted,#64748b)]">
                        {att.approvedLeaves || 0} Leaves • {att.absentDays || 0} Absent Days
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-medium text-[var(--text,#0f172a)]">
                      ₹{Number(payroll.grossSalary || 0).toLocaleString('en-IN')}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-rose-600">
                      -₹{Number(payroll.totalDeductions || 0).toLocaleString('en-IN')}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 text-sm">
                      ₹{Number(payroll.netSalary || 0).toLocaleString('en-IN')}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        isApproved
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : isPending
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          isApproved ? 'bg-emerald-500' : isPending ? 'bg-amber-500' : 'bg-rose-500'
                        }`} />
                        {payroll.status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {isPending && (
                          <>
                            <button
                              onClick={() => handleReview(payroll, 'approved')}
                              className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1"
                              title="Approve for Admin Review"
                            >
                              <Check className="w-3 h-3" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleReview(payroll, 'correction_requested')}
                              className="px-2 py-1 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all cursor-pointer"
                              title="Request Correction"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => setSelectedPayslipPayroll(payroll)}
                          className="p-1.5 text-indigo-600 hover:text-indigo-800 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer"
                          title="Inspect Detailed Salary Slip"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--muted,#64748b)]">
                    <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-sm text-[var(--text,#0f172a)]">No team payroll records found</p>
                    <p className="text-xs mt-1">Admin has not yet generated payroll for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payslip Modal */}
      {selectedPayslipPayroll && (
        <PayslipModal
          payroll={selectedPayslipPayroll}
          onClose={() => setSelectedPayslipPayroll(null)}
        />
      )}
    </div>
  );
}
