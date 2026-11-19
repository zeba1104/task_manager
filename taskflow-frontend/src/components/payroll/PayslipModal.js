import React from 'react';
import { X, Printer, CheckCircle, ShieldCheck, Landmark } from 'lucide-react';
import './Payroll.css';

/**
 * Converts a number to Indian Currency words (e.g. "Forty-Five Thousand Rupees Only")
 */
function numberToWords(num) {
  if (!num || num === 0) return 'Zero Rupees Only';
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  let str = '';
  str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (Number(n[2]) !== 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (Number(n[4]) !== 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (Number(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return str.trim() ? `${str.trim()} Rupees Only` : '';
}

export default function PayslipModal({ payroll, onClose }) {
  if (!payroll) return null;

  const emp = payroll.employee || {};
  const bank = payroll.salaryStructureSnapshot?.bankDetails || {};
  const attendance = payroll.attendanceSnapshot || {};
  const isPaid = payroll.status === 'Paid';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="payslip-modal-backdrop" onClick={onClose}>
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-payslip, #printable-payslip * {
            visibility: visible !important;
          }
          #printable-payslip {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            box-shadow: none !important;
            border: 1px solid #ddd !important;
            background: #ffffff !important;
            color: #111827 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="payslip-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Top Control Bar */}
        <div className="payslip-top-bar no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} color="#4f46e5" />
            <span style={{ fontWeight: '700', fontSize: '13px', textTransform: 'uppercase', color: '#4f46e5', letterSpacing: '0.04em' }}>
              Official Salary Statement
            </span>
            <span className="payroll-badge status-ready" style={{ marginLeft: '8px' }}>
              {payroll.periodLabel}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handlePrint}
              className="btn-action-primary"
              style={{ padding: '6px 14px' }}
              title="Print or Save as PDF"
            >
              <Printer size={13} />
              <span>Print / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-action-icon"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div id="printable-payslip" className="payslip-document">
          {/* Header */}
          <div className="payslip-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#4f46e5', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '16px' }}>
                  TF
                </div>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', letterSpacing: '-0.02em', color: '#0f172a' }}>
                  TASKFLOW ENTERPRISE
                </h1>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                Corporate HQ • Sector 62, Cyber Park • support@taskflow.local
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span className="payroll-badge status-ready" style={{ marginBottom: '4px' }}>
                Payslip for {payroll.periodLabel}
              </span>
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>
                Generated: {new Date(payroll.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Employee & Bank Summary Grid */}
          <div className="payslip-info-grid">
            <div className="payslip-info-item">
              <span className="info-label">Employee Name</span>
              <div className="info-val">{emp.name || 'N/A'}</div>
            </div>
            <div className="payslip-info-item">
              <span className="info-label">Employee ID</span>
              <div className="info-val">{emp.employeeId || 'TF-EMP-001'}</div>
            </div>
            <div className="payslip-info-item">
              <span className="info-label">Designation</span>
              <div className="info-val">{emp.designation || 'Software Engineer'}</div>
            </div>
            <div className="payslip-info-item">
              <span className="info-label">Department</span>
              <div className="info-val">{emp.department || payroll.department || 'Engineering'}</div>
            </div>
            <div className="payslip-info-item">
              <span className="info-label">Bank Name</span>
              <div className="info-val">{bank.bankName || 'HDFC Bank'}</div>
            </div>
            <div className="payslip-info-item">
              <span className="info-label">Account Number</span>
              <div className="info-val" style={{ fontFamily: 'var(--font-mono)' }}>
                {bank.maskedAccountNumber || (bank.accountNumber ? `••••${String(bank.accountNumber).slice(-4)}` : '••••5678')}
              </div>
            </div>
            <div className="payslip-info-item">
              <span className="info-label">IFSC Code</span>
              <div className="info-val" style={{ fontFamily: 'var(--font-mono)' }}>
                {bank.ifsc || 'HDFC0001234'}
              </div>
            </div>
            <div className="payslip-info-item">
              <span className="info-label">Disbursement Status</span>
              <div className="info-val" style={{ color: isPaid ? '#059669' : '#4f46e5', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {isPaid && <CheckCircle size={13} />}
                <span>{isPaid ? 'PAID' : payroll.status.replace(/_/g, ' ')}</span>
              </div>
            </div>
          </div>

          {/* Attendance Overview Bar */}
          <div className="payslip-attendance-bar">
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Total Days</span>
              <span style={{ fontWeight: '800', fontSize: '14px', color: '#0f172a' }}>{attendance.totalDaysInMonth || 30}</span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Working Days</span>
              <span style={{ fontWeight: '800', fontSize: '14px', color: '#0f172a' }}>{attendance.workingDays || 22}</span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Present Days</span>
              <span style={{ fontWeight: '800', fontSize: '14px', color: '#059669' }}>{attendance.presentDays || 0}</span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Approved Leaves</span>
              <span style={{ fontWeight: '800', fontSize: '14px', color: '#4f46e5' }}>{attendance.approvedLeaves || 0}</span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Unpaid / Absent</span>
              <span style={{ fontWeight: '800', fontSize: '14px', color: '#dc2626' }}>{attendance.absentDays || 0}</span>
            </div>
          </div>

          {/* Two-Column Earnings & Deductions Table */}
          <div className="payslip-table-grid">
            {/* Earnings Table */}
            <div className="payslip-table-box">
              <div className="box-header">
                <span>Earnings Component</span>
                <span>Amount (₹)</span>
              </div>
              <div>
                {(payroll.earnings || []).map((item, idx) => (
                  <div key={idx} className="payslip-row">
                    <span style={{ color: '#334155', fontWeight: '500' }}>{item.name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', color: '#0f172a' }}>
                      ₹{Number(item.amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
              <div className="box-total">
                <span>Gross Earnings</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800' }}>
                  ₹{Number(payroll.grossSalary || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Deductions Table */}
            <div className="payslip-table-box">
              <div className="box-header">
                <span>Deduction Component</span>
                <span>Amount (₹)</span>
              </div>
              <div>
                {(payroll.deductions || []).map((item, idx) => (
                  <div key={idx} className="payslip-row">
                    <div>
                      <span style={{ color: '#334155', fontWeight: '500', display: 'block' }}>{item.name}</span>
                      {item.reason && <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>{item.reason}</span>}
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', color: '#dc2626' }}>
                      -₹{Number(item.amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
                {(!payroll.deductions || payroll.deductions.length === 0) && (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' }}>
                    No deductions applied.
                  </div>
                )}
              </div>
              <div className="box-total">
                <span>Total Deductions</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: '#dc2626' }}>
                  -₹{Number(payroll.totalDeductions || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Net Take-Home Highlight Card */}
          <div className="payslip-net-card">
            <div>
              <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#4338ca', display: 'block' }}>
                Net Disbursed Take-Home Pay
              </span>
              <span style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', marginTop: '3px', display: 'block' }}>
                ({numberToWords(payroll.netSalary)})
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '28px', fontWeight: '800', color: '#4f46e5', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>
                ₹{Number(payroll.netSalary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* RazorpayX Banking Transfer Proof & Reference Details */}
          {payroll.payout && (payroll.payout.utr || payroll.payout.payoutId || isPaid) && (
            <div className="payslip-banking-proof">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                <Landmark size={15} color="#059669" />
                <span>Outbound Banking Transaction Proof</span>
                {payroll.payout.isTestMode && (
                  <span className="gateway-status-pill" style={{ marginLeft: '6px' }}>
                    Test Mode Sandbox
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block', fontFamily: 'var(--font-sans)' }}>Banking UTR Reference</span>
                  <span style={{ fontWeight: '700', color: '#0f172a' }}>{payroll.payout.utr || 'UTR-SIMULATED-TEST'}</span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block', fontFamily: 'var(--font-sans)' }}>Payout Transaction ID</span>
                  <span style={{ color: '#475569' }}>{payroll.payout.payoutId || 'N/A'}</span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block', fontFamily: 'var(--font-sans)' }}>Transfer Mode / Time</span>
                  <span style={{ color: '#475569' }}>
                    {payroll.payout.mode || 'IMPS'} • {payroll.payout.processedAt ? new Date(payroll.payout.processedAt).toLocaleString() : 'Recent'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Footer & Disclaimer */}
          <div style={{ marginTop: '28px', paddingTop: '18px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
            <span>Confidential &amp; Proprietary • Taskflow Technologies Private Limited</span>
            <span style={{ fontStyle: 'italic' }}>Computer-generated document; no physical signature required.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
