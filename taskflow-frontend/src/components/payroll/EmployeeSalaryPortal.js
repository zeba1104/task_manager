import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  Clock,
  Landmark,
  FileText,
  AlertCircle,
  ShieldCheck,
  TrendingUp,
  Download
} from 'lucide-react';
import { getMyPayrolls } from '../../api/payrollApi';
import PayslipModal from './PayslipModal';
import './Payroll.css';

export default function EmployeeSalaryPortal({ user }) {
  const [loading, setLoading] = useState(true);
  const [payrolls, setPayrolls] = useState([]);
  const [selectedPayslipPayroll, setSelectedPayslipPayroll] = useState(null);

  const fetchMyPayrolls = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyPayrolls();
      setPayrolls(res.data.data || []);
    } catch (err) {
      console.error('Failed to load salary portal data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyPayrolls();
  }, [fetchMyPayrolls]);

  const latestPayroll = payrolls[0] || null;
  const isPaid = latestPayroll?.status === 'Paid';
  const isProcessing = latestPayroll?.status === 'Processing';

  return (
    <div className="payroll-page-container">
      {/* 1. Page Header */}
      <div className="payroll-header-row">
        <div className="payroll-header-info">
          <div className="payroll-title-icon-box">
            <Landmark size={24} />
          </div>
          <div>
            <h1 className="payroll-main-title">My Salary &amp; Payslips</h1>
            <p className="payroll-subtitle">
              Personal Compensation Portal • Track monthly disbursement lifecycle, attendance deductions, and download official payslips.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="payroll-empty-state">
          <Landmark size={36} color="#4f46e5" className="spinning" />
          <h3>Loading compensation portal...</h3>
        </div>
      ) : latestPayroll ? (
        <>
          {/* 2. Latest Salary Hero Card */}
          <div className="employee-payroll-hero">
            <div className="employee-hero-content">
              <div className="employee-hero-left">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="hero-period-pill">
                    {latestPayroll.periodLabel}
                  </span>
                  <span className={`payroll-badge ${isPaid ? 'status-paid' : 'status-pending'}`} style={{ color: '#ffffff', background: isPaid ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)', borderColor: 'rgba(255, 255, 255, 0.2)' }}>
                    {latestPayroll.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="hero-salary-label">
                  Net Take-Home Salary
                </div>
                <div className="hero-salary-figure">
                  ₹{Number(latestPayroll.netSalary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>

                {latestPayroll.payout?.utr && (
                  <div style={{
                    marginTop: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '6px 14px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)'
                  }}>
                    <Landmark size={14} color="#34d399" />
                    <span>Bank UTR: {latestPayroll.payout.utr}</span>
                  </div>
                )}
              </div>

              <div className="employee-hero-right">
                <button
                  type="button"
                  onClick={() => setSelectedPayslipPayroll(latestPayroll)}
                  className="btn-hero-payslip"
                  title="View, Print and Download Official Payslip or Salary Certificate as PDF"
                >
                  <Download size={16} />
                  <span>Download / View Payslip</span>
                </button>
                <div className="hero-bank-note">
                  Disbursed to: {latestPayroll.salaryStructureSnapshot?.bankDetails?.bankName || 'HDFC Bank'} (••••{String(latestPayroll.salaryStructureSnapshot?.bankDetails?.accountNumber || '5678').slice(-4)})
                </div>
              </div>
            </div>

            {/* Stepper */}
            <div className="employee-hero-stepper">
              <div className="hero-step-item">
                <span className="hero-step-name completed">
                  <CheckCircle size={14} /> 1. Calculation
                </span>
                <span className="hero-step-detail">Attendance verified</span>
              </div>

              <div className="hero-step-item">
                <span className={`hero-step-name ${
                  ['Manager_Approved', 'Ready_for_Payment', 'Processing', 'Paid'].includes(latestPayroll.status)
                    ? 'completed'
                    : 'current'
                }`}>
                  {['Manager_Approved', 'Ready_for_Payment', 'Processing', 'Paid'].includes(latestPayroll.status) ? (
                    <CheckCircle size={14} />
                  ) : (
                    <Clock size={14} />
                  )}
                  2. Manager Review
                </span>
                <span className="hero-step-detail">
                  {latestPayroll.managerReview?.status === 'approved' ? 'Verified by Manager' : 'In Review'}
                </span>
              </div>

              <div className="hero-step-item">
                <span className={`hero-step-name ${
                  ['Ready_for_Payment', 'Processing', 'Paid'].includes(latestPayroll.status)
                    ? 'completed'
                    : 'upcoming'
                }`}>
                  {['Ready_for_Payment', 'Processing', 'Paid'].includes(latestPayroll.status) ? (
                    <CheckCircle size={14} />
                  ) : (
                    <Clock size={14} />
                  )}
                  3. Admin Sign-off
                </span>
                <span className="hero-step-detail">
                  {['Ready_for_Payment', 'Processing', 'Paid'].includes(latestPayroll.status) ? 'Approved for payment' : 'Pending'}
                </span>
              </div>

              <div className="hero-step-item">
                <span className={`hero-step-name ${isPaid ? 'completed' : isProcessing ? 'current' : 'upcoming'}`}>
                  {isPaid ? <CheckCircle size={14} /> : <Clock size={14} />}
                  4. Bank Transfer
                </span>
                <span className="hero-step-detail">
                  {isPaid ? 'Deposited via RazorpayX' : isProcessing ? 'Processing' : 'Queued'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Itemized Breakdown Cards */}
          <div className="payroll-breakdown-grid">
            {/* Earnings Breakdown */}
            <div className="breakdown-card">
              <div className="breakdown-card-header">
                <div className="breakdown-card-title">
                  <TrendingUp size={16} color="#059669" />
                  <span>Itemized Earnings</span>
                </div>
                <div className="breakdown-total emerald">
                  Gross: ₹{Number(latestPayroll.grossSalary || 0).toLocaleString('en-IN')}
                </div>
              </div>
              <div className="breakdown-items-list">
                {(latestPayroll.earnings || []).map((e, idx) => (
                  <div key={idx} className="breakdown-item-row">
                    <div className="item-name-wrap">
                      <span className="main-name">{e.name}</span>
                    </div>
                    <div className="item-amount-val">
                      ₹{Number(e.amount).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Deductions Breakdown */}
            <div className="breakdown-card">
              <div className="breakdown-card-header">
                <div className="breakdown-card-title">
                  <AlertCircle size={16} color="#dc2626" />
                  <span>Itemized Deductions</span>
                </div>
                <div className="breakdown-total rose">
                  Total: -₹{Number(latestPayroll.totalDeductions || 0).toLocaleString('en-IN')}
                </div>
              </div>
              <div className="breakdown-items-list">
                {(latestPayroll.deductions || []).map((d, idx) => (
                  <div key={idx} className="breakdown-item-row">
                    <div className="item-name-wrap">
                      <span className="main-name">{d.name}</span>
                      {d.reason && <div className="sub-reason">{d.reason}</div>}
                    </div>
                    <div className="item-amount-val deduction">
                      -₹{Number(d.amount).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
                {(!latestPayroll.deductions || latestPayroll.deductions.length === 0) && (
                  <div style={{ textAlign: 'center', padding: '16px', color: 'var(--muted)', fontStyle: 'italic' }}>
                    No deductions applied for this period.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="payroll-empty-state-card">
          <div className="empty-state-icon-box">
            <Landmark size={28} />
          </div>
          <h3 className="empty-state-title">No Compensation Records for This Period</h3>
          <p className="empty-state-subtitle">
            Your official monthly payslips, itemized earnings, and RazorpayX banking transfer receipts will be visible here once the organizational payroll cycle is generated and approved.
          </p>
          <div className="empty-state-tips">
            <div className="empty-tip-pill">
              <ShieldCheck size={13} color="#10b981" />
              <span>Direct Bank Deposit</span>
            </div>
            <div className="empty-tip-pill">
              <Clock size={13} color="#4f46e5" />
              <span>Real-Time Approval Tracking</span>
            </div>
            <div className="empty-tip-pill">
              <FileText size={13} color="#059669" />
              <span>Downloadable PDF Payslips</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Historical Salary Records */}
      {payrolls.length > 0 && (
        <div className="payroll-table-card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>
              Salary Disbursement History
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              Archived monthly payment records and downloadable payslips.
            </p>
          </div>

          <div className="payroll-table-wrapper">
            <table className="payroll-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Net Take-Home</th>
                  <th>Status</th>
                  <th>Banking UTR</th>
                  <th>Disbursed Date</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {payrolls.map((p) => (
                  <tr key={p._id}>
                    <td style={{ fontWeight: '700' }}>
                      {p.periodLabel}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: '#4f46e5' }}>
                      ₹{Number(p.netSalary || 0).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <span className={`payroll-badge ${p.status === 'Paid' ? 'status-paid' : 'status-pending'}`}>
                        {p.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)' }}>
                      {p.payout?.utr || '—'}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {p.payout?.processedAt
                        ? new Date(p.payout.processedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : 'Pending'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedPayslipPayroll(p)}
                        className="btn-action-primary"
                        style={{ padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                        title="Download or View Payslip PDF"
                      >
                        <Download size={12} />
                        <span>PDF / Payslip</span>
                      </button>
                    </td>
                  </tr>
                ))}
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
    </div>
  );
}
