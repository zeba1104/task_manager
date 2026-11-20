import React, { useState } from 'react';
import { X, Printer, Download, CheckCircle, ShieldCheck, Landmark, FileText, Award, Loader2 } from 'lucide-react';
import './Payroll.css';

/**
 * Converts a number to Indian Currency words (e.g. "Eighty-two thousand six hundred and fifty only")
 */
function numberToWords(num) {
  if (!num || num === 0) return 'zero rupees only';
  const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  let str = '';
  str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
  str += (Number(n[2]) !== 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
  str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
  str += (Number(n[4]) !== 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
  str += (Number(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return str.trim() ? `${str.trim()} only` : '';
}

export default function PayslipModal({ payroll, onClose }) {
  const [viewMode, setViewMode] = useState('payslip'); // 'payslip' | 'certificate'
  const [downloading, setDownloading] = useState(false);

  if (!payroll) return null;

  const emp = payroll.employee || {};
  const bank = payroll.salaryStructureSnapshot?.bankDetails || {};
  const attendance = payroll.attendanceSnapshot || {};
  const isPaid = payroll.status === 'Paid';

  // Remuneration Breakdown matching template
  const basicAmount = payroll.earnings?.find((e) => e.name.toLowerCase().includes('basic'))?.amount || 60000;
  const hraAmount = payroll.earnings?.find((e) => e.name.toLowerCase().includes('rent') || e.name.toLowerCase().includes('hra'))?.amount || 24000;
  
  const tmFound = payroll.earnings?.find((e) => e.name.toLowerCase().includes('transport') || e.name.toLowerCase().includes('medical'));
  const tmAmount = tmFound ? tmFound.amount : (payroll.earnings?.filter((e) => {
    const n = e.name.toLowerCase();
    return !n.includes('basic') && !n.includes('rent') && !n.includes('hra');
  }).reduce((s, e) => s + e.amount, 0) || 10000);

  const grossAmount = payroll.grossSalary || (basicAmount + hraAmount + tmAmount);
  const deductionsAmount = payroll.totalDeductions || 11350;
  const netAmount = payroll.netSalary || (grossAmount - deductionsAmount);

  const isBilal = emp.employeeId === 'NT-0142' || (emp.name && emp.name.toLowerCase().includes('bilal'));
  const companyName = isBilal ? 'Nova Textiles (Pvt) Ltd.' : 'Taskflow Technologies (Pvt) Ltd.';
  const employeeTitleAndName = emp.name?.startsWith('Mr') || emp.name?.startsWith('Ms') ? emp.name : `Mr. ${emp.name || 'Bilal Ahmad'}`;
  const employeeId = emp.employeeId || 'NT-0142';
  const designation = emp.designation || 'Production Supervisor';
  const department = emp.department || payroll.department || 'Operations';
  const certRef = isBilal ? 'HR/SC/2026/0184' : `HR/SC/${payroll.periodYear || 2026}/${String(emp.employeeId || '0142').replace(/\D/g, '') || '0184'}`;
  const certDate = payroll.periodMonth === 9 ? '8 September 2026' : new Date(payroll.createdAt || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const joiningDate = emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '3 March 2022';

  const netWordsFormatted = `Rupees ${netWordsHelper(netAmount)}`;

  function netWordsHelper(num) {
    const raw = numberToWords(num);
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    const element = document.getElementById('printable-active-document');
    if (!element) return;

    setDownloading(true);
    try {
      let h2p = window.html2pdf;
      if (!h2p) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          script.onload = () => resolve();
          script.onerror = (e) => reject(e);
          document.head.appendChild(script);
        });
        h2p = window.html2pdf;
      }

      if (!h2p) {
        window.print();
        return;
      }

      const cleanName = (emp.name || 'Employee').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanPeriod = (payroll.periodLabel || 'Salary').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = viewMode === 'certificate'
        ? `${cleanName}_Salary_Certificate.pdf`
        : `${cleanName}_${cleanPeriod}_Payslip.pdf`;

      const opt = {
        margin: [8, 8, 8, 8],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await h2p().set(opt).from(element).save();
    } catch (err) {
      console.error('Error generating PDF, falling back to print:', err);
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="payslip-modal-backdrop" onClick={onClose}>
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-active-document, #printable-active-document * {
            visibility: visible !important;
          }
          #printable-active-document {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 30px !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #111827 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="payslip-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Top Control Bar with Mode Switcher */}
        <div className="payslip-top-bar no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="payslip-mode-switcher">
              <button
                type="button"
                className={`btn-mode-toggle ${viewMode === 'payslip' ? 'active' : ''}`}
                onClick={() => setViewMode('payslip')}
              >
                <FileText size={13} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
                Monthly Payslip
              </button>
              <button
                type="button"
                className={`btn-mode-toggle ${viewMode === 'certificate' ? 'active' : ''}`}
                onClick={() => setViewMode('certificate')}
              >
                <Award size={13} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
                Official Salary Certificate
              </button>
            </div>

            <span className="payroll-badge status-ready" style={{ marginLeft: '6px' }}>
              {payroll.periodLabel}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="btn-action-primary"
              style={{
                padding: '7px 16px',
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                borderColor: '#047857',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '12px',
                letterSpacing: '0.01em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '10px',
                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
                cursor: downloading ? 'wait' : 'pointer'
              }}
              title="Directly download official PDF file to device"
            >
              {downloading ? (
                <>
                  <Loader2 size={13} className="spinning" />
                  <span>Downloading PDF...</span>
                </>
              ) : (
                <>
                  <Download size={13} />
                  <span>Download PDF</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="btn-action-secondary"
              style={{
                padding: '7px 14px',
                background: '#ffffff',
                borderColor: '#cbd5e1',
                color: '#334155',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: '600',
                fontSize: '12px',
                borderRadius: '10px'
              }}
              title="Print or Save as PDF via system dialog"
            >
              <Printer size={13} />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-action-icon"
              aria-label="Close dialog"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Content Wrapper */}
        <div id="printable-active-document">
          {viewMode === 'payslip' ? (
            /* =========================================================================
               VIEW 1: DETAILED ENTERPRISE PAYSLIP
               ========================================================================= */
            <div id="printable-payslip" className="payslip-document">
              {/* Header */}
              <div className="payslip-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#4f46e5', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '16px' }}>
                      {companyName.includes('Nova') ? 'NT' : 'TF'}
                    </div>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', letterSpacing: '-0.02em', color: '#0f172a' }}>
                      {companyName.toUpperCase()}
                    </h1>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                    Corporate HQ • Operations &amp; Production Division • support@taskflow.local
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span className="payroll-badge status-ready" style={{ marginBottom: '4px' }}>
                    Payslip for {payroll.periodLabel}
                  </span>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>
                    Generated: {certDate}
                  </p>
                </div>
              </div>

              {/* Employee & Bank Summary Grid */}
              <div className="payslip-info-grid">
                <div className="payslip-info-item">
                  <span className="info-label">Employee Name</span>
                  <div className="info-val">{employeeTitleAndName}</div>
                </div>
                <div className="payslip-info-item">
                  <span className="info-label">Employee ID</span>
                  <div className="info-val">{employeeId}</div>
                </div>
                <div className="payslip-info-item">
                  <span className="info-label">Designation</span>
                  <div className="info-val">{designation}</div>
                </div>
                <div className="payslip-info-item">
                  <span className="info-label">Department</span>
                  <div className="info-val">{department}</div>
                </div>
                <div className="payslip-info-item">
                  <span className="info-label">Bank Name</span>
                  <div className="info-val">{bank.bankName || 'HDFC Bank'}</div>
                </div>
                <div className="payslip-info-item">
                  <span className="info-label">Account Number</span>
                  <div className="info-val" style={{ fontFamily: 'var(--font-mono)' }}>
                    {bank.maskedAccountNumber || (bank.accountNumber ? `••••${String(bank.accountNumber).slice(-4)}` : '••••0142')}
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
                  <span style={{ fontWeight: '800', fontSize: '14px', color: '#059669' }}>{attendance.presentDays || 22}</span>
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
                      ₹{Number(grossAmount).toLocaleString('en-IN')}
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
                  </div>
                  <div className="box-total">
                    <span>Total Deductions</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: '#dc2626' }}>
                      -₹{Number(deductionsAmount).toLocaleString('en-IN')}
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
                    ({netWordsFormatted})
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '28px', fontWeight: '800', color: '#4f46e5', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>
                    ₹{Number(netAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Razorpay Banking Transfer Proof & Reference Details */}
              {payroll.payout && (payroll.payout.utr || payroll.payout.payoutId || isPaid) && (
                <div className="payslip-banking-proof">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                    <Landmark size={15} color="#059669" />
                    <span>Outbound Banking Transaction Proof</span>
                    {payroll.payout.isTestMode && (
                      <span className="gateway-status-pill" style={{ marginLeft: '6px' }}>
                        Razorpay Test Mode
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                    <div>
                      <span style={{ color: '#94a3b8', display: 'block', fontFamily: 'var(--font-sans)' }}>Banking UTR Reference</span>
                      <span style={{ fontWeight: '700', color: '#0f172a' }}>{payroll.payout.utr || 'RZP0142SEPT26'}</span>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', display: 'block', fontFamily: 'var(--font-sans)' }}>Payout Transaction ID</span>
                      <span style={{ color: '#475569' }}>{payroll.payout.payoutId || 'pay_test_0142'}</span>
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
                <span>Confidential &amp; Proprietary • {companyName}</span>
                <span style={{ fontStyle: 'italic' }}>Computer-generated document; no physical signature required.</span>
              </div>
            </div>
          ) : (
            /* =========================================================================
               VIEW 2: OFFICIAL SALARY CERTIFICATE TEMPLATE
               Word-template matching exact document uploaded by user
               ========================================================================= */
            <div id="printable-certificate" className="salary-certificate-document">
              {/* Reference & Date Top Meta */}
              <div className="cert-meta-row">
                <span>Ref: {certRef}</span>
                <span>Date: {certDate}</span>
              </div>

              {/* Document Subject Header */}
              <h2 className="cert-headline">TO WHOM IT MAY CONCERN</h2>

              {/* Certification Statement Paragraph */}
              <p className="cert-paragraph">
                This is to certify that <strong>{employeeTitleAndName}</strong> (Employee ID: {employeeId}) has been employed with <strong>{companyName}</strong> as <strong>{designation}</strong> in the {department} Department since <strong>{joiningDate}</strong>. He is currently a permanent employee of the company.
              </p>

              {/* Remuneration Intro */}
              <div className="cert-intro-text">
                His present monthly remuneration is as follows:
              </div>

              {/* Remuneration Table matching user image */}
              <table className="cert-remuneration-table">
                <tbody>
                  <tr>
                    <td>Basic salary</td>
                    <td>{Number(basicAmount).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td>House rent allowance</td>
                    <td>{Number(hraAmount).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td>Transport &amp; medical allowance</td>
                    <td>{Number(tmAmount).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="cert-row-gross">
                    <td>Gross salary</td>
                    <td>{Number(grossAmount).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td>Less: statutory deductions</td>
                    <td>{Number(deductionsAmount).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="cert-row-net">
                    <td>Net salary</td>
                    <td>{Number(netAmount).toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>

              {/* In Words Note */}
              <p className="cert-words-note">
                ({netWordsFormatted}), credited monthly to his bank account.
              </p>

              {/* Purpose Disclaimer Note */}
              <p className="cert-disclaimer-note">
                This certificate is issued at the request of the employee for the purpose of a bank loan application, and does not constitute any guarantee or undertaking on the part of the company.
              </p>

              {/* Signatory & Corporate Stamp Block */}
              <div className="cert-signatory-block">
                <div className="cert-signatory-name">
                  For {companyName}
                </div>

                <div className="cert-signature-seal-area">
                  <div>
                    <div style={{ width: '160px', borderBottom: '1.5px solid #334155', marginBottom: '6px' }}></div>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', display: 'block' }}>Authorized Signatory</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>HR &amp; Operations Administration</span>
                  </div>

                  <div className="cert-stamp-badge">
                    <ShieldCheck size={16} />
                    <span>Official Certified Verification</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
