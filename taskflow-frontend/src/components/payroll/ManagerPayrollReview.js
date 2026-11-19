import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  CheckCircle,
  AlertCircle,
  Clock,
  Eye,
  Check,
  X,
  Search,
  ShieldCheck,
  RefreshCw,
  Sparkles
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
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'correction'
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

  // Helper for avatar initials
  const getInitials = (name) => {
    if (!name) return 'TF';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getAvatarVariant = (name) => {
    if (!name) return '';
    const code = name.charCodeAt(0) % 3;
    if (code === 0) return 'emerald';
    if (code === 1) return 'amber';
    return '';
  };

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

  // Filtered List
  const filtered = useMemo(() => {
    return teamPayrolls.filter((p) => {
      // Status filter
      if (statusFilter === 'pending' && p.status !== 'Pending_Manager_Review') return false;
      if (statusFilter === 'approved' && !['Manager_Approved', 'Ready_for_Payment', 'Paid'].includes(p.status)) return false;
      if (statusFilter === 'correction' && p.status !== 'Manager_Correction_Requested') return false;

      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const name = (p.employee?.name || '').toLowerCase();
        const id = (p.employee?.employeeId || '').toLowerCase();
        const desig = (p.employee?.designation || '').toLowerCase();
        if (!name.includes(q) && !id.includes(q) && !desig.includes(q)) return false;
      }

      return true;
    });
  }, [teamPayrolls, statusFilter, searchQuery]);

  return (
    <div className="payroll-page-container">
      {/* 1. Signature Hero Banner (Matching the acclaimed Leave & Quotas design) */}
      <div className="payroll-hero-banner">
        <div className="payroll-hero-top">
          <span className="payroll-hero-badge">
            <ShieldCheck size={14} />
            MANAGER GOVERNANCE &amp; ATTENDANCE AUDIT
          </span>
          <span className="payroll-hero-period-pill">
            <Sparkles size={12} color="#a5b4fc" style={{ marginRight: '4px' }} />
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </span>
        </div>

        <div className="payroll-hero-body">
          <div className="payroll-hero-text">
            <h1 className="payroll-hero-title">Team Payroll &amp; Attendance Review</h1>
            <p className="payroll-hero-subtitle">
              Verify employee attendance snapshots, approved leaves, and calculated net payable before forwarding to Admin for RazorpayX disbursement.
            </p>
          </div>

          <div className="payroll-hero-actions">
            <div className="hero-selectors-wrap">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="hero-select"
                title="Select Review Month"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={idx} value={idx + 1}>{m}</option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="hero-select"
                title="Select Review Year"
              >
                {[2025, 2026, 2027].map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleBulkApprove}
              disabled={loading || (teamOverview?.pendingReviewCount || 0) === 0}
              className="btn-hero-approve"
              title="Bulk approve all pending team records"
            >
              <CheckCircle size={15} />
              <span>Approve Team ({teamOverview?.pendingReviewCount || 0})</span>
            </button>

            <button
              type="button"
              onClick={fetchTeamData}
              disabled={loading}
              className="hero-select"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px' }}
              title="Refresh Team Payroll"
            >
              <RefreshCw size={13} className={loading ? 'spinning' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Team Overview KPI Cards (Strictly 4 balanced columns on desktop) */}
      <div className="payroll-kpi-grid">
        <div className="payroll-kpi-card">
          <div className="kpi-header">
            <span className="kpi-title-text">Assigned Team Members</span>
            <span className="kpi-badge-pill indigo">TOTAL ROSTER</span>
          </div>
          <div className="kpi-body-row">
            <div className="kpi-amount">
              {teamOverview?.totalTeamMembers || 0}
            </div>
            <div className="kpi-icon-squircle indigo">
              <Users size={18} />
            </div>
          </div>
          <div className="kpi-footer">
            <span>{teamOverview?.department || 'Operations Team'}</span>
            <span>•</span>
            <span>Direct Reports</span>
          </div>
        </div>

        <div className="payroll-kpi-card">
          <div className="kpi-header">
            <span className="kpi-title-text">Pending Review</span>
            <span className="kpi-badge-pill amber">ACTION NEEDED</span>
          </div>
          <div className="kpi-body-row">
            <div className="kpi-amount amber">
              {teamOverview?.pendingReviewCount || 0}
            </div>
            <div className="kpi-icon-squircle amber">
              <Clock size={18} />
            </div>
          </div>
          <div className="kpi-footer">
            <span className="pulse-dot" style={{ background: '#f59e0b', width: '6px', height: '6px', borderRadius: '50%' }} />
            <span>Requires manager verification</span>
          </div>
        </div>

        <div className="payroll-kpi-card">
          <div className="kpi-header">
            <span className="kpi-title-text">Manager Approved</span>
            <span className="kpi-badge-pill emerald">VERIFIED</span>
          </div>
          <div className="kpi-body-row">
            <div className="kpi-amount emerald">
              {teamOverview?.approvedCount || 0}
            </div>
            <div className="kpi-icon-squircle emerald">
              <CheckCircle size={18} />
            </div>
          </div>
          <div className="kpi-footer">
            <span>Forwarded to Admin for Payout</span>
          </div>
        </div>

        <div className="payroll-kpi-card">
          <div className="kpi-header">
            <span className="kpi-title-text">Corrections Requested</span>
            <span className="kpi-badge-pill rose">REVISION</span>
          </div>
          <div className="kpi-body-row">
            <div className="kpi-amount rose">
              {teamOverview?.correctionCount || 0}
            </div>
            <div className="kpi-icon-squircle rose">
              <AlertCircle size={18} />
            </div>
          </div>
          <div className="kpi-footer">
            <span>Returned for adjustment</span>
          </div>
        </div>
      </div>

      {/* 3. Filter Pills & Guaranteed Non-Overlapping Search Bar */}
      <div className="payroll-filter-bar">
        <div className="payroll-quick-filters">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`payroll-filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
          >
            <span>All Members</span>
            <span className="pill-counter">{teamPayrolls.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`payroll-filter-pill ${statusFilter === 'pending' ? 'active' : ''}`}
          >
            <span>Needs Review</span>
            <span className="pill-counter">{teamOverview?.pendingReviewCount || 0}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('approved')}
            className={`payroll-filter-pill ${statusFilter === 'approved' ? 'active' : ''}`}
          >
            <span>Manager Approved</span>
            <span className="pill-counter">{teamOverview?.approvedCount || 0}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('correction')}
            className={`payroll-filter-pill ${statusFilter === 'correction' ? 'active' : ''}`}
          >
            <span>Corrections</span>
            <span className="pill-counter">{teamOverview?.correctionCount || 0}</span>
          </button>
        </div>

        {/* Enterprise Search Box */}
        <div className="payroll-search-input-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search member by name, ID or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="payroll-search-clear-btn"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 4. Team Payroll Table */}
      <div className="payroll-table-card">
        <div className="payroll-table-wrapper">
          <table className="payroll-table">
            <thead>
              <tr>
                <th>Member Name</th>
                <th>Attendance Snapshot</th>
                <th>Gross Earnings</th>
                <th>Absence / Deductions</th>
                <th>Net Take-Home</th>
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

                // Attendance calculation
                const workingDays = att.workingDays || 22;
                const presentDays = att.presentDays || 0;
                const attendancePct = Math.min(100, Math.round((presentDays / (workingDays || 1)) * 100));

                return (
                  <tr key={payroll._id}>
                    <td>
                      <div className="emp-cell-flex">
                        <div className={`emp-avatar-circle ${getAvatarVariant(emp.name)}`}>
                          {getInitials(emp.name)}
                        </div>
                        <div>
                          <div className="emp-name-text">{emp.name || 'Team Member'}</div>
                          <div className="emp-sub-row">
                            <span className="emp-id-tag">{emp.employeeId || 'TF-EMP'}</span>
                            <span className="emp-role-tag">{emp.designation || 'Specialist'}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="attendance-visual-cell">
                        <div className="attendance-ratio-badge">
                          <span>{presentDays} / {workingDays} Days</span>
                          <span className="attendance-ratio-pct">{attendancePct}%</span>
                        </div>
                        <div className="attendance-track">
                          <div className="attendance-fill" style={{ width: `${attendancePct}%` }} />
                        </div>
                        <div className="attendance-sub-stats">
                          <span>{att.approvedLeaves || 0} Leaves Approved</span>
                          <span>•</span>
                          <span>{att.absentDays || 0} Absent</span>
                        </div>
                      </div>
                    </td>

                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '13.5px' }}>
                      ₹{Number(payroll.grossSalary || 0).toLocaleString('en-IN')}
                    </td>

                    <td>
                      {Number(payroll.totalDeductions || 0) > 0 ? (
                        <span style={{ fontFamily: 'var(--font-mono)', color: '#dc2626', fontWeight: '700', fontSize: '13px' }}>
                          -₹{Number(payroll.totalDeductions || 0).toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)', fontSize: '13px' }}>
                          ₹0
                        </span>
                      )}
                    </td>

                    <td>
                      <span className="net-salary-pill">
                        ₹{Number(payroll.netSalary || 0).toLocaleString('en-IN')}
                      </span>
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
                              <Check size={13} />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReview(payroll, 'correction_requested')}
                              className="btn-action-danger"
                              title="Request Correction"
                            >
                              <X size={13} />
                              <span>Adjust</span>
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
                      <Users size={36} color="#6366f1" />
                      <h3>No team payroll records found</h3>
                      <p>
                        {teamPayrolls.length === 0
                          ? `Admin has not yet generated payroll for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}.`
                          : 'No team members match your current search or filter criteria.'}
                      </p>
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
