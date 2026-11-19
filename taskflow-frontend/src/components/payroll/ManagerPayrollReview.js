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
import './Payroll.css';

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
    <div className="payroll-page-container">
      {/* 1. Page Header & Actions */}
      <div className="payroll-header-row">
        <div className="payroll-header-info">
          <div className="payroll-title-icon-box">
            <Users size={24} />
          </div>
          <div>
            <h1 className="payroll-main-title">Team Payroll &amp; Attendance Review</h1>
            <p className="payroll-subtitle">
              Manager Review Portal • Verify employee attendance snapshots, approved leaves, and net payable before Admin payout.
            </p>
          </div>
        </div>

        {/* Toolbar */}
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
            onClick={handleBulkApprove}
            disabled={loading || (teamOverview?.pendingReviewCount || 0) === 0}
            className="btn-batch-payout"
          >
            <Check size={14} />
            <span>Approve Team ({teamOverview?.pendingReviewCount || 0})</span>
          </button>
        </div>
      </div>

      {/* 2. Team Overview KPI Cards */}
      <div className="payroll-kpi-grid">
        <div className="payroll-kpi-card">
          <div className="kpi-header">
            <span>Assigned Team Members</span>
            <Users size={16} color="#4f46e5" />
          </div>
          <div className="kpi-amount">
            {teamOverview?.totalTeamMembers || 0}
          </div>
          <div className="kpi-subtext">
            {teamOverview?.department || 'Operations Team'}
          </div>
        </div>

        <div className="payroll-kpi-card">
          <div className="kpi-header">
            <span>Pending Review</span>
            <Clock size={16} color="#d97706" />
          </div>
          <div className="kpi-amount amber">
            {teamOverview?.pendingReviewCount || 0}
          </div>
          <div className="kpi-subtext">
            Requires manager verification
          </div>
        </div>

        <div className="payroll-kpi-card">
          <div className="kpi-header">
            <span>Manager Approved</span>
            <CheckCircle size={16} color="#059669" />
          </div>
          <div className="kpi-amount emerald">
            {teamOverview?.approvedCount || 0}
          </div>
          <div className="kpi-subtext">
            Forwarded to Admin
          </div>
        </div>

        <div className="payroll-kpi-card">
          <div className="kpi-header">
            <span>Corrections Requested</span>
            <AlertCircle size={16} color="#dc2626" />
          </div>
          <div className="kpi-amount rose" style={{ color: '#dc2626' }}>
            {teamOverview?.correctionCount || 0}
          </div>
          <div className="kpi-subtext">
            Returned for adjustment
          </div>
        </div>
      </div>

      {/* 3. Search Bar */}
      <div className="payroll-filter-bar">
        <div className="payroll-search-input-wrap" style={{ minWidth: '300px' }}>
          <Search size={14} />
          <input
            type="text"
            placeholder="Search team member by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 4. Team Payroll Table */}
      <div className="payroll-table-card">
        <div className="payroll-table-wrapper">
          <table className="payroll-table">
            <thead>
              <tr>
                <th>Member Name</th>
                <th>Attendance Verification</th>
                <th>Gross Earnings</th>
                <th>Absence / Deductions</th>
                <th>Net Salary</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Review Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((payroll) => {
                const emp = payroll.employee || {};
                const att = payroll.attendanceSnapshot || {};
                const isPending = payroll.status === 'Pending_Manager_Review';
                const isApproved = ['Manager_Approved', 'Ready_for_Payment', 'Paid'].includes(payroll.status);

                return (
                  <tr key={payroll._id}>
                    <td>
                      <div className="emp-name-text">{emp.name}</div>
                      <div className="emp-sub-text">
                        {emp.employeeId || 'TF-EMP'} • {emp.designation || 'Specialist'}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: '600', fontSize: '12px' }}>
                        {att.presentDays || 0} / {att.workingDays || 22} Present
                      </div>
                      <div className="emp-sub-text">
                        {att.approvedLeaves || 0} Leaves • {att.absentDays || 0} Absent Days
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
                        isApproved ? 'status-paid' : isPending ? 'status-pending' : 'status-failed'
                      }`}>
                        <span className="pulse-dot" style={{
                          background: isApproved ? '#10b981' : isPending ? '#f59e0b' : '#ef4444',
                          width: '6px', height: '6px', borderRadius: '50%'
                        }} />
                        {payroll.status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div className="payroll-actions-group">
                        {isPending && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleReview(payroll, 'approved')}
                              className="btn-action-success"
                              title="Approve for Admin Review"
                            >
                              <Check size={12} />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReview(payroll, 'correction_requested')}
                              className="btn-action-danger"
                              title="Request Correction"
                            >
                              <X size={12} />
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedPayslipPayroll(payroll)}
                          className="btn-action-icon"
                          title="Inspect Detailed Salary Slip"
                        >
                          <Eye size={14} color="#4f46e5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="payroll-empty-state">
                      <Users size={32} />
                      <h3>No team payroll records found</h3>
                      <p>Admin has not yet generated payroll for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.</p>
                    </div>
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
