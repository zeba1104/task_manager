import React from 'react';
import { X, Printer, CheckCircle, ShieldCheck, Landmark } from 'lucide-react';

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
  const isProcessing = payroll.status === 'Processing';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      {/* Print-specific style block */}
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

      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-[var(--surface,#ffffff)] border border-[var(--border,#e2e8f0)] rounded-2xl shadow-2xl flex flex-col text-[var(--text,#1e293b)]">
        {/* Top Control Bar */}
        <div className="no-print sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-[var(--panel,#f8fafc)] border-b border-[var(--border,#e2e8f0)] rounded-t-2xl">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <span className="font-semibold text-sm tracking-wide uppercase text-indigo-600">
              Official Salary Statement
            </span>
            <span className="px-2.5 py-0.5 ml-2 text-xs font-medium rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {payroll.periodLabel}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
              title="Print or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Print / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div id="printable-payslip" className="p-8 bg-white text-slate-900 font-sans">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b-2 border-indigo-600 gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                  TF
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                  TASKFLOW ENTERPRISE
                </h1>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Corporate HQ • Sector 62, Cyber Park • support@taskflow.local
              </p>
            </div>

            <div className="md:text-right">
              <span className="inline-block px-3 py-1 text-xs font-semibold tracking-wide uppercase rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 mb-1">
                Payslip for {payroll.periodLabel}
              </span>
              <p className="text-xs text-slate-500">
                Generated: {new Date(payroll.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Employee & Bank Summary Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 text-xs border-b border-slate-200">
            <div>
              <span className="text-slate-400 block font-medium">Employee Name</span>
              <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{emp.name || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Employee ID</span>
              <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{emp.employeeId || 'TF-EMP-001'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Designation</span>
              <span className="font-semibold text-slate-800 mt-0.5 block">{emp.designation || 'Software Engineer'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Department</span>
              <span className="font-semibold text-slate-800 mt-0.5 block">{emp.department || payroll.department || 'Engineering'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Bank Name</span>
              <span className="font-semibold text-slate-800 mt-0.5 block">{bank.bankName || 'HDFC Bank'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Account Number</span>
              <span className="font-mono font-medium text-slate-800 mt-0.5 block">
                {bank.maskedAccountNumber || (bank.accountNumber ? `••••${String(bank.accountNumber).slice(-4)}` : '••••5678')}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">IFSC Code</span>
              <span className="font-mono font-medium text-slate-800 mt-0.5 block">{bank.ifsc || 'HDFC0001234'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Disbursement Status</span>
              <span className={`inline-flex items-center gap-1 font-semibold mt-0.5 ${
                isPaid ? 'text-emerald-600' : isProcessing ? 'text-amber-600' : 'text-indigo-600'
              }`}>
                {isPaid && <CheckCircle className="w-3.5 h-3.5" />}
                {isPaid ? 'PAID' : payroll.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          {/* Attendance Overview Bar */}
          <div className="my-5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 md:grid-cols-5 gap-3 text-center text-xs">
            <div>
              <span className="text-slate-500 block">Total Days</span>
              <span className="font-bold text-slate-800 text-sm">{attendance.totalDaysInMonth || 30}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Standard Working Days</span>
              <span className="font-bold text-slate-800 text-sm">{attendance.workingDays || 22}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Present Days</span>
              <span className="font-bold text-emerald-600 text-sm">{attendance.presentDays || 0}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Approved Leaves</span>
              <span className="font-bold text-indigo-600 text-sm">{attendance.approvedLeaves || 0}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Unpaid / Absent</span>
              <span className="font-bold text-rose-600 text-sm">{attendance.absentDays || 0}</span>
            </div>
          </div>

          {/* Two-Column Earnings & Deductions Table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
            {/* Earnings Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100/80 px-4 py-2.5 font-semibold text-xs text-slate-700 tracking-wide uppercase border-b border-slate-200 flex justify-between">
                <span>Earnings Breakdown</span>
                <span>Amount (₹)</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {(payroll.earnings || []).map((item, idx) => (
                  <div key={idx} className="flex justify-between px-4 py-2.5 hover:bg-slate-50/50">
                    <span className="text-slate-600 font-medium">{item.name}</span>
                    <span className="font-mono font-semibold text-slate-800">
                      ₹{Number(item.amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 px-4 py-3 font-semibold text-xs text-slate-900 border-t border-slate-200 flex justify-between">
                <span>Total Gross Earnings</span>
                <span className="font-mono font-bold text-sm text-slate-900">
                  ₹{Number(payroll.grossSalary || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Deductions Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100/80 px-4 py-2.5 font-semibold text-xs text-slate-700 tracking-wide uppercase border-b border-slate-200 flex justify-between">
                <span>Deductions Breakdown</span>
                <span>Amount (₹)</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {(payroll.deductions || []).map((item, idx) => (
                  <div key={idx} className="flex justify-between px-4 py-2.5 hover:bg-slate-50/50">
                    <div>
                      <span className="text-slate-600 font-medium block">{item.name}</span>
                      {item.reason && <span className="text-[10px] text-slate-400 block">{item.reason}</span>}
                    </div>
                    <span className="font-mono font-semibold text-rose-600">
                      -₹{Number(item.amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
                {(!payroll.deductions || payroll.deductions.length === 0) && (
                  <div className="px-4 py-4 text-center text-slate-400 italic">No deductions applied.</div>
                )}
              </div>
              <div className="bg-slate-50 px-4 py-3 font-semibold text-xs text-slate-900 border-t border-slate-200 flex justify-between">
                <span>Total Deductions</span>
                <span className="font-mono font-bold text-sm text-rose-600">
                  -₹{Number(payroll.totalDeductions || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Net Take-Home Highlight Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-50 border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 block">
                Net Disbursed Take-Home Pay
              </span>
              <span className="text-xs text-slate-500 italic mt-0.5 block">
                ({numberToWords(payroll.netSalary)})
              </span>
            </div>
            <div className="text-right">
              <span className="text-3xl font-extrabold text-indigo-600 font-mono tracking-tight">
                ₹{Number(payroll.netSalary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* RazorpayX Banking Transfer Proof & Reference Details */}
          {payroll.payout && (payroll.payout.utr || payroll.payout.payoutId || isPaid) && (
            <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-slate-800 mb-1">
                <Landmark className="w-4 h-4 text-emerald-600" />
                <span>Outbound Banking Transaction Proof</span>
                {payroll.payout.isTestMode && (
                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-100 text-amber-800 font-medium">
                    Test Mode Sandbox
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                <div>
                  <span className="text-slate-400 block font-sans">Banking UTR Reference</span>
                  <span className="font-bold text-slate-800">{payroll.payout.utr || 'UTR-SIMULATED-TEST'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-sans">Payout Transaction ID</span>
                  <span className="text-slate-700">{payroll.payout.payoutId || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-sans">Transfer Mode / Time</span>
                  <span className="text-slate-700">
                    {payroll.payout.mode || 'IMPS'} • {payroll.payout.processedAt ? new Date(payroll.payout.processedAt).toLocaleString() : 'Recent'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Footer & Disclaimer */}
          <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
            <p>Confidential & Proprietary • Taskflow Technologies Private Limited</p>
            <p className="italic">Computer-generated document; no physical signature required.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
