import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  Clock,
  Landmark,
  TrendingUp,
  FileText,
  AlertCircle
} from 'lucide-react';
import { getMyPayrolls } from '../../api/payrollApi';
import PayslipModal from './PayslipModal';

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
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text,#0f172a)]">
          My Salary & Payslips
        </h1>
        <p className="text-xs text-[var(--muted,#64748b)] mt-0.5">
          Personal Compensation Portal • Track monthly disbursement lifecycle, attendance deductions, and download official payslips.
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center rounded-3xl bg-[var(--surface,#ffffff)] border border-[var(--border,#e2e8f0)] shadow-xs">
          <Landmark className="w-8 h-8 text-indigo-500 animate-pulse mx-auto mb-2" />
          <p className="text-xs text-[var(--muted,#64748b)]">Loading compensation portal...</p>
        </div>
      ) : latestPayroll ? (
        <>
          {/* Latest Salary Hero Card */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 backdrop-blur-md text-indigo-200 border border-white/10">
                    {latestPayroll.periodLabel}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    isPaid
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : isProcessing
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-white/10 text-white border border-white/20'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    {latestPayroll.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="mt-4">
                  <span className="text-xs uppercase tracking-wider text-indigo-200/80 font-medium block">
                    Net Take-Home Salary
                  </span>
                  <div className="text-4xl md:text-5xl font-extrabold font-mono tracking-tight mt-1 text-white">
                    ₹{Number(latestPayroll.netSalary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                {latestPayroll.payout?.utr && (
                  <div className="mt-3 flex items-center gap-2 text-xs font-mono text-indigo-200 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 w-fit">
                    <Landmark className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Bank UTR: {latestPayroll.payout.utr}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setSelectedPayslipPayroll(latestPayroll)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-bold text-indigo-950 bg-white hover:bg-slate-100 rounded-2xl shadow-lg transition-all cursor-pointer hover:scale-105 active:scale-95"
                >
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>View Official Payslip</span>
                </button>
                <div className="text-[11px] text-center text-indigo-200/60">
                  Transferred to: {latestPayroll.salaryStructureSnapshot?.bankDetails?.bankName || 'HDFC Bank'} (••••{String(latestPayroll.salaryStructureSnapshot?.bankDetails?.accountNumber || '5678').slice(-4)})
                </div>
              </div>
            </div>

            {/* Workflow Progress Steps */}
            <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-emerald-400 font-bold block flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> 1. Calculation
                </span>
                <span className="text-indigo-200 text-[11px] block">Attendance compiled</span>
              </div>
              <div className="space-y-1">
                <span className={`font-bold block flex items-center gap-1 ${
                  ['Manager_Approved', 'Ready_for_Payment', 'Processing', 'Paid'].includes(latestPayroll.status)
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}>
                  {['Manager_Approved', 'Ready_for_Payment', 'Processing', 'Paid'].includes(latestPayroll.status) ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : (
                    <Clock className="w-3.5 h-3.5" />
                  )}
                  2. Manager Review
                </span>
                <span className="text-indigo-200 text-[11px] block">
                  {latestPayroll.managerReview?.status === 'approved' ? 'Verified by Manager' : 'Under Review'}
                </span>
              </div>
              <div className="space-y-1">
                <span className={`font-bold block flex items-center gap-1 ${
                  ['Ready_for_Payment', 'Processing', 'Paid'].includes(latestPayroll.status)
                    ? 'text-emerald-400'
                    : 'text-white/40'
                }`}>
                  {['Ready_for_Payment', 'Processing', 'Paid'].includes(latestPayroll.status) ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : (
                    <Clock className="w-3.5 h-3.5" />
                  )}
                  3. Admin Approval
                </span>
                <span className="text-indigo-200 text-[11px] block">
                  {['Ready_for_Payment', 'Processing', 'Paid'].includes(latestPayroll.status) ? 'Approved for payout' : 'Pending'}
                </span>
              </div>
              <div className="space-y-1">
                <span className={`font-bold block flex items-center gap-1 ${
                  isPaid ? 'text-emerald-400' : isProcessing ? 'text-amber-400' : 'text-white/40'
                }`}>
                  {isPaid ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  4. Bank Transfer
                </span>
                <span className="text-indigo-200 text-[11px] block">
                  {isPaid ? 'Deposited via RazorpayX' : isProcessing ? 'In Progress' : 'Queued'}
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown Grids */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Earnings Breakdown */}
            <div className="p-5 rounded-2xl bg-[var(--surface,#ffffff)] border border-[var(--border,#e2e8f0)] shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border,#e2e8f0)]">
                <h3 className="font-semibold text-sm text-[var(--text,#0f172a)] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>Itemized Earnings</span>
                </h3>
                <span className="text-xs font-mono font-bold text-emerald-600">
                  Gross: ₹{Number(latestPayroll.grossSalary || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="divide-y divide-[var(--border,#e2e8f0)] text-xs">
                {(latestPayroll.earnings || []).map((e, idx) => (
                  <div key={idx} className="flex justify-between py-2.5">
                    <span className="text-[var(--muted,#64748b)] font-medium">{e.name}</span>
                    <span className="font-mono font-semibold text-[var(--text,#0f172a)]">
                      ₹{Number(e.amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Deductions Breakdown */}
            <div className="p-5 rounded-2xl bg-[var(--surface,#ffffff)] border border-[var(--border,#e2e8f0)] shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border,#e2e8f0)]">
                <h3 className="font-semibold text-sm text-[var(--text,#0f172a)] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>Itemized Deductions</span>
                </h3>
                <span className="text-xs font-mono font-bold text-rose-600">
                  Total: -₹{Number(latestPayroll.totalDeductions || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="divide-y divide-[var(--border,#e2e8f0)] text-xs">
                {(latestPayroll.deductions || []).map((d, idx) => (
                  <div key={idx} className="flex justify-between py-2.5">
                    <div>
                      <span className="text-[var(--muted,#64748b)] font-medium block">{d.name}</span>
                      {d.reason && <span className="text-[10px] text-slate-400 block">{d.reason}</span>}
                    </div>
                    <span className="font-mono font-semibold text-rose-600">
                      -₹{Number(d.amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
                {(!latestPayroll.deductions || latestPayroll.deductions.length === 0) && (
                  <div className="py-4 text-center text-slate-400 italic">No deductions applied.</div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="p-12 text-center rounded-3xl bg-[var(--surface,#ffffff)] border border-[var(--border,#e2e8f0)] shadow-xs">
          <Landmark className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-[var(--text,#0f172a)]">No Payroll Generated Yet</h3>
          <p className="text-xs text-[var(--muted,#64748b)] mt-1 max-w-sm mx-auto">
            Your compensation records will appear here as soon as Admin generates the payroll for this period.
          </p>
        </div>
      )}

      {/* Historical Payroll Records Table */}
      {payrolls.length > 0 && (
        <div className="bg-[var(--surface,#ffffff)] border border-[var(--border,#e2e8f0)] rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[var(--border,#e2e8f0)]">
            <h3 className="font-bold text-sm text-[var(--text,#0f172a)]">
              Salary Disbursement History
            </h3>
            <p className="text-xs text-[var(--muted,#64748b)]">
              Archived monthly payment records and downloadable payslips.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--panel,#f8fafc)] text-[var(--muted,#64748b)] font-semibold border-b border-[var(--border,#e2e8f0)]">
                <tr>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Net Salary</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Banking UTR</th>
                  <th className="py-3 px-4">Disbursed Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border,#e2e8f0)]">
                {payrolls.map((p) => (
                  <tr key={p._id} className="hover:bg-[var(--panel,#f8fafc)]/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-[var(--text,#0f172a)]">
                      {p.periodLabel}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                      ₹{Number(p.netSalary || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        p.status === 'Paid'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {p.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[var(--muted,#64748b)]">
                      {p.payout?.utr || '—'}
                    </td>
                    <td className="py-3 px-4 text-[var(--muted,#64748b)]">
                      {p.payout?.processedAt
                        ? new Date(p.payout.processedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : 'Pending'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedPayslipPayroll(p)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Payslip</span>
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
