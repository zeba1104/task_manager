const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const Holiday = require('../models/Holiday');

/**
 * Calculates monthly salary breakdown based on employee's salary structure,
 * actual attendance logs, and approved leave records.
 */
const calculateMonthlySalary = async (employee, salaryStructure, month, year) => {
  const m = Number(month);
  const y = Number(year);

  // Month boundary dates
  const totalDaysInMonth = new Date(y, m, 0).getDate();
  const monthStartStr = `${y}-${String(m).padStart(2, '0')}-01`;
  const monthEndStr = `${y}-${String(m).padStart(2, '0')}-${String(totalDaysInMonth).padStart(2, '0')}`;
  const monthStartDate = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const monthEndDate = new Date(y, m - 1, totalDaysInMonth, 23, 59, 59, 999);

  // Calculate standard working days (Mon-Fri)
  let standardWorkingDays = 0;
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const d = new Date(y, m - 1, day);
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) and not Saturday (6)
      standardWorkingDays++;
    }
  }

  // Fetch employee attendance records for the month
  const attendanceRecords = await Attendance.find({
    user: employee._id,
    date: { $gte: monthStartStr, $lte: monthEndStr }
  }).lean();

  let presentCount = 0;
  let halfDayCount = 0;
  let lateCount = 0;

  attendanceRecords.forEach((rec) => {
    if (rec.status === 'present') {
      // Check duration: if logged less than 4 hours (14400s), count as half day
      if (rec.totalSeconds && rec.totalSeconds > 0 && rec.totalSeconds < 14400) {
        halfDayCount++;
      } else {
        presentCount++;
      }
    } else if (rec.status === 'late') {
      lateCount++;
      presentCount++;
    }
  });

  // Fetch approved leave requests overlapping this month
  const approvedLeaves = await LeaveRequest.find({
    user: employee._id,
    status: 'approved',
    startDate: { $lte: monthEndDate },
    endDate: { $gte: monthStartDate }
  }).lean();

  let approvedLeaveDays = 0;
  let unpaidLeaveDays = 0;

  approvedLeaves.forEach((leave) => {
    // Calculate overlap days in this month
    const lStart = new Date(Math.max(new Date(leave.startDate).getTime(), monthStartDate.getTime()));
    const lEnd = new Date(Math.min(new Date(leave.endDate).getTime(), monthEndDate.getTime()));
    const diffTime = Math.max(0, lEnd.getTime() - lStart.getTime());
    const daysInCurrentMonth = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const effectiveDays = Math.min(leave.totalDays || daysInCurrentMonth, daysInCurrentMonth);

    if (leave.isUnpaid) {
      unpaidLeaveDays += effectiveDays;
    } else {
      approvedLeaveDays += effectiveDays;
    }
  });

  // Basic salary & pro-rated daily rate
  const basicSalary = Number(salaryStructure?.basicSalary) || 30000;
  const dailyRate = Math.round((basicSalary / standardWorkingDays) * 100) / 100;

  // Unexcused absences: if present + approved leaves is less than working days
  const accountedDays = presentCount + (halfDayCount * 0.5) + approvedLeaveDays;
  const unexcusedDays = Math.max(0, standardWorkingDays - accountedDays);
  const absentDays = unexcusedDays + unpaidLeaveDays;

  // Attendance-based deduction
  const attendanceDeductionAmount = Math.round(absentDays * dailyRate);

  // Earnings assembly
  const earnings = [
    { name: 'Basic Salary', amount: basicSalary }
  ];

  let totalAllowances = 0;
  if (Array.isArray(salaryStructure?.allowances)) {
    salaryStructure.allowances.forEach((alw) => {
      const amt = Number(alw.amount) || 0;
      earnings.push({ name: alw.name || 'Allowance', amount: amt });
      totalAllowances += amt;
    });
  }

  const bonusAmount = Number(salaryStructure?.bonus) || 0;
  if (bonusAmount > 0) {
    earnings.push({ name: 'Performance Bonus / Incentive', amount: bonusAmount });
  }

  const grossSalary = basicSalary + totalAllowances + bonusAmount;

  // Deductions assembly
  const deductions = [];
  let totalFixedDeductions = 0;

  if (Array.isArray(salaryStructure?.deductions)) {
    salaryStructure.deductions.forEach((ded) => {
      let amt = 0;
      if (ded.type === 'percentage') {
        amt = Math.round((basicSalary * (Number(ded.amount) || 0)) / 100);
      } else {
        amt = Number(ded.amount) || 0;
      }
      deductions.push({
        name: ded.name || 'Statutory Deduction',
        amount: amt,
        reason: 'Standard statutory component'
      });
      totalFixedDeductions += amt;
    });
  }

  if (attendanceDeductionAmount > 0) {
    deductions.push({
      name: 'Attendance & Unpaid Leave Deduction',
      amount: attendanceDeductionAmount,
      reason: `${absentDays} unexcused / unpaid day(s) @ ₹${dailyRate}/day`
    });
  }

  const totalDeductions = totalFixedDeductions + attendanceDeductionAmount;
  const netSalary = Math.max(0, Math.round(grossSalary - totalDeductions));

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const periodLabel = `${monthNames[m - 1]} ${y}`;

  return {
    periodMonth: m,
    periodYear: y,
    periodLabel,
    salaryStructureSnapshot: {
      basicSalary,
      allowances: salaryStructure?.allowances || [],
      bonus: bonusAmount,
      deductions: salaryStructure?.deductions || [],
      bankDetails: salaryStructure?.bankDetails || {}
    },
    attendanceSnapshot: {
      totalDaysInMonth,
      workingDays: standardWorkingDays,
      presentDays: presentCount,
      approvedLeaves: approvedLeaveDays,
      unpaidLeaves: unpaidLeaveDays,
      halfDays: halfDayCount,
      absentDays,
      overtimeHours: 0
    },
    earnings,
    deductions,
    grossSalary,
    totalDeductions,
    netSalary
  };
};

module.exports = {
  calculateMonthlySalary
};
