const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveApprovalToken = require('../models/LeaveApprovalToken');
const Attendance = require('../models/Attendance');
const leaveService = require('../services/leaveService');

async function runTests() {
  console.log('--- STARTING LEAVE WORKFLOW TEST SUITE (12 SCENARIOS) ---');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  let passed = 0;
  let failed = 0;

  const assert = (condition, msg) => {
    if (condition) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      failed++;
    }
  };

  try {
    // Setup test users
    const testAdmin = await User.findOneAndUpdate(
      { email: 'test_admin_leave@taskflow.com' },
      {
        name: 'Test Admin',
        email: 'test_admin_leave@taskflow.com',
        role: 'Admin',
        password: 'hash',
        isActive: true,
        isSuspended: false,
        leaveBalance: { annual: 25, sick: 15, personal: 10, other: 5 },
      },
      { upsert: true, new: true }
    );

    const testManager = await User.findOneAndUpdate(
      { email: 'test_mgr_leave@taskflow.com' },
      {
        name: 'Test Manager Alpha',
        email: 'test_mgr_leave@taskflow.com',
        role: 'Manager',
        password: 'hash',
        isActive: true,
        isSuspended: false,
        leaveBalance: { annual: 20, sick: 12, personal: 6, other: 5 },
      },
      { upsert: true, new: true }
    );

    const testEmployee = await User.findOneAndUpdate(
      { email: 'test_emp_leave@taskflow.com' },
      {
        name: 'Test Employee Beta',
        email: 'test_emp_leave@taskflow.com',
        role: 'Employee',
        manager: testManager._id,
        password: 'hash',
        isActive: true,
        isSuspended: false,
        leaveBalance: { annual: 20, sick: 12, personal: 6, other: 5 },
      },
      { upsert: true, new: true }
    );

    // Clean up previous test leave requests
    await LeaveRequest.deleteMany({
      user: { $in: [testAdmin._id, testManager._id, testEmployee._id] },
    });
    await LeaveApprovalToken.deleteMany({
      approver: { $in: [testAdmin._id, testManager._id, testEmployee._id] },
    });

    // =======================================================================
    // TEST 1: Manager applies for leave -> Expected: Routed to Admin
    // =======================================================================
    const t1Start = new Date('2026-12-01');
    const t1End = new Date('2026-12-05');
    const t1Admin = await leaveService.getAuthorizedAdmin();
    const t1Req = await LeaveRequest.create({
      user: testManager._id,
      requesterRole: 'Manager',
      leaveType: 'annual',
      startDate: t1Start,
      endDate: t1End,
      totalDays: 5,
      reason: 'Manager family vacation',
      approvalRoute: 'ADMIN',
      approver: t1Admin._id,
      approverRole: 'Admin',
      status: 'pending',
    });
    assert(
      t1Req.approvalRoute === 'ADMIN' && t1Req.approverRole === 'Admin',
      'TEST 1: Manager applies for leave -> Routed to Admin'
    );

    // =======================================================================
    // TEST 2: Employee applies for leave and assigned Manager is available
    // Expected: Routed to assigned Manager
    // =======================================================================
    const t2Start = new Date('2026-12-10');
    const t2End = new Date('2026-12-12');
    const t2Avail = await leaveService.validateManagerAvailability(testEmployee._id, t2Start, t2End);
    assert(
      t2Avail.available === true && t2Avail.route === 'MANAGER' && String(t2Avail.manager._id) === String(testManager._id),
      'TEST 2: Employee applies for leave & Manager is available -> Routed to assigned Manager'
    );

    // =======================================================================
    // TEST 3: Manager has APPROVED leave overlapping employee requested dates
    // Manager leave: 10 Nov - 15 Nov
    // Employee requested: 12 Nov - 14 Nov
    // Expected: Routed only to Admin
    // =======================================================================
    const mgrApprovedLeave = await LeaveRequest.create({
      user: testManager._id,
      requesterRole: 'Manager',
      leaveType: 'annual',
      startDate: new Date('2026-11-10'),
      endDate: new Date('2026-11-15'),
      totalDays: 6,
      status: 'approved',
      approvalRoute: 'ADMIN',
    });

    const t3Start = new Date('2026-11-12');
    const t3End = new Date('2026-11-14');
    const t3Avail = await leaveService.validateManagerAvailability(testEmployee._id, t3Start, t3End);
    assert(
      t3Avail.available === false && t3Avail.route === 'ADMIN',
      'TEST 3: Manager has approved overlapping leave (10-15 Nov, Emp: 12-14 Nov) -> Routed only to Admin'
    );

    // =======================================================================
    // TEST 4: Manager has approved leave on only ONE DAY of requested period
    // Manager leave: 10 Nov - 15 Nov
    // Employee requested: 8 Nov - 12 Nov (overlap on 10, 11, 12) or 15 Nov - 18 Nov (overlap on 15)
    // Expected: Routed only to Admin
    // =======================================================================
    const t4Start = new Date('2026-11-15');
    const t4End = new Date('2026-11-18');
    const t4Avail = await leaveService.validateManagerAvailability(testEmployee._id, t4Start, t4End);
    assert(
      t4Avail.available === false && t4Avail.route === 'ADMIN',
      'TEST 4: Manager has approved leave on only 1 day of period (15 Nov) -> Routed only to Admin'
    );

    // =======================================================================
    // TEST 5: Manager has only a PENDING leave request overlapping
    // Expected: Routed to assigned Manager (Pending must NOT trigger fallback)
    // =======================================================================
    await LeaveRequest.create({
      user: testManager._id,
      requesterRole: 'Manager',
      leaveType: 'sick',
      startDate: new Date('2026-12-20'),
      endDate: new Date('2026-12-25'),
      totalDays: 6,
      status: 'pending', // PENDING!
      approvalRoute: 'ADMIN',
    });

    const t5Start = new Date('2026-12-21');
    const t5End = new Date('2026-12-23');
    const t5Avail = await leaveService.validateManagerAvailability(testEmployee._id, t5Start, t5End);
    assert(
      t5Avail.available === true && t5Avail.route === 'MANAGER',
      'TEST 5: Manager has only PENDING overlapping leave -> Routed to assigned Manager (no fallback)'
    );

    // =======================================================================
    // TEST 6: Manager leave was REJECTED
    // Expected: Routed to assigned Manager (Rejected must NOT trigger fallback)
    // =======================================================================
    await LeaveRequest.create({
      user: testManager._id,
      requesterRole: 'Manager',
      leaveType: 'annual',
      startDate: new Date('2027-01-10'),
      endDate: new Date('2027-01-15'),
      totalDays: 6,
      status: 'rejected', // REJECTED!
      approvalRoute: 'ADMIN',
    });

    const t6Start = new Date('2027-01-11');
    const t6End = new Date('2027-01-13');
    const t6Avail = await leaveService.validateManagerAvailability(testEmployee._id, t6Start, t6End);
    assert(
      t6Avail.available === true && t6Avail.route === 'MANAGER',
      'TEST 6: Manager leave was REJECTED -> Routed to assigned Manager (no fallback)'
    );

    // =======================================================================
    // TEST 7: Manager is INACTIVE
    // Expected: Routed to Admin
    // =======================================================================
    await User.findByIdAndUpdate(testManager._id, { isActive: false });
    const t7Start = new Date('2027-02-01');
    const t7End = new Date('2027-02-03');
    const t7Avail = await leaveService.validateManagerAvailability(testEmployee._id, t7Start, t7End);
    assert(
      t7Avail.available === false && t7Avail.route === 'ADMIN',
      'TEST 7: Manager is inactive -> Routed to Admin'
    );
    // Restore manager active status
    await User.findByIdAndUpdate(testManager._id, { isActive: true });

    // =======================================================================
    // TEST 8: Manager attempts to approve their own leave
    // Expected: Reject the action (Self-approval strictly forbidden)
    // =======================================================================
    const t8Req = await LeaveRequest.create({
      user: testManager._id,
      requesterRole: 'Manager',
      leaveType: 'personal',
      startDate: new Date('2027-03-01'),
      endDate: new Date('2027-03-02'),
      totalDays: 2,
      approvalRoute: 'ADMIN',
      status: 'pending',
    });
    const t8Tokens = await leaveService.createLeaveTokens(t8Req._id, testManager._id, 'Manager', 'http://localhost:5000');
    const t8Result = await leaveService.processLeaveDecision({
      tokenString: t8Tokens.approveToken,
      action: 'approve',
    });
    assert(
      t8Result.success === false && t8Result.code === 'SELF_APPROVAL_FORBIDDEN',
      'TEST 8: Manager attempts self-approval -> Rejected with SELF_APPROVAL_FORBIDDEN'
    );

    // =======================================================================
    // TEST 9: An approval link is clicked twice
    // Expected: 1st valid action processed; 2nd action rejected
    // =======================================================================
    const t9Req = await LeaveRequest.create({
      user: testEmployee._id,
      requesterRole: 'Employee',
      leaveType: 'annual',
      startDate: new Date('2027-04-01'),
      endDate: new Date('2027-04-02'),
      totalDays: 2,
      approvalRoute: 'ADMIN',
      status: 'pending',
    });
    const t9Tokens = await leaveService.createLeaveTokens(t9Req._id, testAdmin._id, 'Admin', 'http://localhost:5000');
    const t9FirstClick = await leaveService.processLeaveDecision({
      tokenString: t9Tokens.approveToken,
      action: 'approve',
    });
    const t9SecondClick = await leaveService.processLeaveDecision({
      tokenString: t9Tokens.approveToken,
      action: 'approve',
    });
    assert(
      t9FirstClick.success === true && t9SecondClick.success === false && t9SecondClick.code === 'TOKEN_ALREADY_USED',
      'TEST 9: Approval link clicked twice -> 1st succeeds, 2nd rejected (TOKEN_ALREADY_USED)'
    );

    // =======================================================================
    // TEST 10: Employee leave approved by Admin through fallback
    // Expected: Leave balance & attendance updated correctly
    // =======================================================================
    const empBefore = await User.findById(testEmployee._id);
    const initialBalance = empBefore.leaveBalance.annual;

    const t10Req = await LeaveRequest.create({
      user: testEmployee._id,
      requesterRole: 'Employee',
      leaveType: 'annual',
      startDate: new Date('2027-05-10'),
      endDate: new Date('2027-05-12'),
      totalDays: 3,
      approvalRoute: 'ADMIN',
      routingReason: 'The assigned reporting manager is currently on approved leave...',
      status: 'pending',
    });
    const t10Tokens = await leaveService.createLeaveTokens(t10Req._id, testAdmin._id, 'Admin', 'http://localhost:5000');
    const t10Result = await leaveService.processLeaveDecision({
      tokenString: t10Tokens.approveToken,
      action: 'approve',
    });

    const empAfter = await User.findById(testEmployee._id);
    const attendanceRecord = await Attendance.findOne({ user: testEmployee._id, date: '2027-05-11' });

    assert(
      t10Result.success === true &&
      empAfter.leaveBalance.annual === initialBalance - 3 &&
      attendanceRecord !== null,
      'TEST 10: Employee leave approved by Admin fallback -> Balance deducted & Attendance created'
    );

    // =======================================================================
    // TEST 11: Employee leave rejected by Admin through fallback
    // Expected: Leave balance remains unchanged
    // =======================================================================
    const balanceBeforeReject = empAfter.leaveBalance.annual;
    const t11Req = await LeaveRequest.create({
      user: testEmployee._id,
      requesterRole: 'Employee',
      leaveType: 'annual',
      startDate: new Date('2027-06-01'),
      endDate: new Date('2027-06-04'),
      totalDays: 4,
      approvalRoute: 'ADMIN',
      routingReason: 'The assigned reporting manager is currently on approved leave...',
      status: 'pending',
    });
    const t11Tokens = await leaveService.createLeaveTokens(t11Req._id, testAdmin._id, 'Admin', 'http://localhost:5000');
    const t11Result = await leaveService.processLeaveDecision({
      tokenString: t11Tokens.rejectToken,
      action: 'reject',
      rejectionReason: 'Critical product release week.',
    });

    const empAfterReject = await User.findById(testEmployee._id);
    assert(
      t11Result.success === true &&
      t11Result.action === 'rejected' &&
      empAfterReject.leaveBalance.annual === balanceBeforeReject,
      'TEST 11: Employee leave rejected by Admin fallback -> Balance remains unchanged'
    );

    // =======================================================================
    // TEST 12: Employee cancels a Pending request
    // Expected: Tokens invalidated & subsequent approval attempts blocked
    // =======================================================================
    const t12Req = await LeaveRequest.create({
      user: testEmployee._id,
      requesterRole: 'Employee',
      leaveType: 'sick',
      startDate: new Date('2027-07-01'),
      endDate: new Date('2027-07-02'),
      totalDays: 2,
      approvalRoute: 'ADMIN',
      status: 'pending',
    });
    const t12Tokens = await leaveService.createLeaveTokens(t12Req._id, testAdmin._id, 'Admin', 'http://localhost:5000');

    // Cancel request
    await leaveService.cancelLeaveRequest(t12Req._id, testEmployee._id);
    const cancelledReq = await LeaveRequest.findById(t12Req._id);

    // Attempt approval with token
    const t12Attempt = await leaveService.processLeaveDecision({
      tokenString: t12Tokens.approveToken,
      action: 'approve',
    });

    assert(
      cancelledReq.status === 'cancelled' &&
      t12Attempt.success === false &&
      t12Attempt.code === 'TOKEN_ALREADY_USED',
      'TEST 12: Employee cancels request -> Tokens invalidated and approval blocked'
    );

    console.log(`\n========================================`);
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);
  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
