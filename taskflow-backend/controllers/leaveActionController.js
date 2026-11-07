const LeaveApprovalToken = require('../models/LeaveApprovalToken');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const leaveService = require('../services/leaveService');
const { sendLeaveDecisionEmail } = require('../config/email');

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[c]));

/**
 * Common HTML wrapper with modern responsive styling.
 */
const renderPage = ({ title, content, isSuccess, isError }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Taskflow Leave Portal</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #0f172a;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .portal-card {
      background: #ffffff;
      width: 100%;
      max-width: 600px;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.45);
      border: 1px solid rgba(255, 255, 255, 0.1);
      animation: popIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes popIn {
      from { opacity: 0; transform: scale(0.96) translateY(10px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .portal-header {
      background: #0f172a;
      color: #ffffff;
      padding: 24px 28px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      position: relative;
    }
    .brand-pill {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: #94a3b8;
      margin-bottom: 6px;
    }
    .portal-header h2 {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .portal-header p {
      font-size: 12.5px;
      color: #94a3b8;
      margin-top: 4px;
    }
    .portal-body {
      padding: 28px;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 22px;
      background: #f8fafc;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      font-size: 13.5px;
    }
    .details-table td {
      padding: 10px 14px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }
    .details-table tr:last-child td { border-bottom: none; }
    .label-col {
      color: #64748b;
      font-weight: 600;
      width: 36%;
    }
    .val-col {
      color: #0f172a;
      font-weight: 700;
    }
    .pill {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .pill-type { background: #e0f2fe; color: #0369a1; }
    .pill-days { background: #dcfce7; color: #15803d; }
    .pill-admin { background: #fef3c7; color: #b45309; }
    .action-banner {
      padding: 14px 18px;
      border-radius: 10px;
      margin-bottom: 20px;
      font-size: 13.5px;
      line-height: 1.5;
    }
    .banner-approve { background: #ecfdf5; border-left: 4px solid #10b981; color: #065f46; }
    .banner-reject { background: #fef2f2; border-left: 4px solid #ef4444; color: #991b1b; }
    .banner-info { background: #f0f9ff; border-left: 4px solid #0284c7; color: #075985; }
    .banner-warning { background: #fffbeb; border-left: 4px solid #f59e0b; color: #92400e; }
    .form-group {
      margin-bottom: 18px;
    }
    .form-group label {
      display: block;
      font-size: 12.5px;
      font-weight: 700;
      color: #334155;
      margin-bottom: 6px;
    }
    .form-control {
      width: 100%;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px;
      font-size: 13.5px;
      font-family: inherit;
      outline: none;
      transition: all 0.15s ease;
    }
    .form-control:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.15s ease;
      text-decoration: none;
      width: 100%;
    }
    .btn-approve {
      background: #10b981;
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
    }
    .btn-approve:hover { background: #059669; transform: translateY(-1px); }
    .btn-reject {
      background: #ef4444;
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(239, 68, 68, 0.35);
    }
    .btn-reject:hover { background: #dc2626; transform: translateY(-1px); }
    .btn-ghost {
      background: #f1f5f9;
      color: #475569;
      margin-top: 10px;
    }
    .btn-ghost:hover { background: #e2e8f0; color: #0f172a; }
    .portal-footer {
      padding: 14px 28px;
      background: #fafbfc;
      border-top: 1px solid #f1f5f9;
      font-size: 11.5px;
      color: #94a3b8;
      text-align: center;
    }
    .status-icon-wrap {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      margin: 0 auto 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
    }
    .icon-success { background: #dcfce7; color: #15803d; }
    .icon-rejected { background: #fee2e2; color: #dc2626; }
    .icon-info { background: #e0f2fe; color: #0284c7; }
    .icon-warn { background: #fef3c7; color: #b45309; }
    .btn-close-tab {
      background: #0f172a;
      color: #ffffff;
      padding: 13px 24px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.25);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 9px;
      width: 100%;
      margin-top: 18px;
      transition: all 0.18s ease;
      font-family: inherit;
    }
    .btn-close-tab:hover {
      background: #1e293b;
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.35);
    }
    .btn-close-tab:active {
      transform: translateY(0);
    }
    .close-fallback-hint {
      display: none;
      font-size: 12px;
      color: #64748b;
      margin-top: 10px;
      text-align: center;
      line-height: 1.4;
      background: #f8fafc;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
  </style>
  <script>
    function closeThisTab() {
      try {
        window.open('', '_self', '');
        window.close();
      } catch (e) {}
      setTimeout(function() {
        if (!window.closed) {
          var hint = document.getElementById('close-fallback-hint');
          if (hint) {
            hint.style.display = 'block';
          }
        }
      }, 250);
    }
  </script>
</head>
<body>
  <div class="portal-card">
    <div class="portal-header">
      <span class="brand-pill">TASKFLOW &bull; SECURE LEAVE APPROVAL</span>
      <h2>${escapeHtml(title)}</h2>
      <p>Hierarchical decision portal &bull; Zero login required</p>
    </div>
    <div class="portal-body">
      ${content}
    </div>
    <div class="portal-footer">
      Secured with single-use cryptographic tokens &bull; &copy; Taskflow System
    </div>
  </div>
</body>
</html>
`;

const closeTabButtonHtml = `
  <button type="button" class="btn-close-tab" onclick="closeThisTab()">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    Close This Tab
  </button>
  <div id="close-fallback-hint" class="close-fallback-hint">
    Notice: If your browser prevents automatic tab closure, press <strong>Ctrl+W</strong> (or <strong>Cmd+W</strong>) or close this tab at the top.
  </div>
`;

/**
 * GET /api/leave/action?token=...
 * Displays the action confirmation page without mutating state.
 * Prevents automated email security scanners from triggering decisions.
 */
exports.showLeaveActionPage = async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send(renderPage({
      title: 'Missing Token',
      content: `
        <div class="action-banner banner-reject">
          <strong>Invalid Request:</strong> No approval token was provided in the link.
        </div>
        <p style="color: #64748b; font-size: 13.5px;">Please check the original email notification and click the button again.</p>
      `,
    }));
  }

  const tokenDoc = await LeaveApprovalToken.findOne({ token }).populate('approver');
  if (!tokenDoc) {
    return res.status(404).send(renderPage({
      title: 'Invalid Link',
      content: `
        <div class="status-icon-wrap icon-rejected">✕</div>
        <h3 style="text-align: center; margin-bottom: 8px;">Link Not Found or Invalid</h3>
        <p style="text-align: center; color: #64748b; font-size: 13.5px; line-height: 1.5;">
          This approval link is invalid, has been tampered with, or does not exist.
        </p>
      `,
    }));
  }

  if (tokenDoc.isUsed) {
    return res.status(200).send(renderPage({
      title: 'Action Already Processed',
      content: `
        <div class="status-icon-wrap icon-info">✓</div>
        <h3 style="text-align: center; margin-bottom: 8px;">Decision Already Recorded</h3>
        <div class="action-banner banner-info" style="text-align: center;">
          This action link was already processed on <strong>${new Date(tokenDoc.usedAt).toLocaleString()}</strong>.
        </div>
        <p style="text-align: center; color: #64748b; font-size: 13.5px;">
          No further action is required. The leave request status has been updated in the system.
        </p>
        ${closeTabButtonHtml}
      `,
    }));
  }

  if (new Date() > tokenDoc.expiresAt) {
    return res.status(200).send(renderPage({
      title: 'Link Expired',
      content: `
        <div class="status-icon-wrap icon-warn">⏱</div>
        <h3 style="text-align: center; margin-bottom: 8px;">Approval Link Expired</h3>
        <div class="action-banner banner-warning" style="text-align: center;">
          This link expired on ${new Date(tokenDoc.expiresAt).toLocaleString()}.
        </div>
        <p style="text-align: center; color: #64748b; font-size: 13.5px;">
          For security, approval tokens expire after 7 days. Please access the Taskflow portal to complete this review.
        </p>
        ${closeTabButtonHtml}
      `,
    }));
  }

  const leaveRequest = await LeaveRequest.findById(tokenDoc.leaveRequest)
    .populate('user')
    .populate('assignedManager');

  if (!leaveRequest) {
    return res.status(404).send(renderPage({
      title: 'Request Not Found',
      content: `<p style="color: #64748b;">The requested leave request no longer exists.</p>${closeTabButtonHtml}`,
    }));
  }

  if (leaveRequest.status === 'cancelled') {
    return res.status(200).send(renderPage({
      title: 'Request Cancelled',
      content: `
        <div class="status-icon-wrap icon-warn">⚠️</div>
        <h3 style="text-align: center; margin-bottom: 8px;">Leave Request Cancelled</h3>
        <div class="action-banner banner-warning" style="text-align: center;">
          This leave request was cancelled by the requester on ${new Date(leaveRequest.cancelledAt || leaveRequest.updatedAt).toLocaleString()}.
        </div>
        <p style="text-align: center; color: #64748b; font-size: 13.5px;">No decision can be submitted for a cancelled request.</p>
        ${closeTabButtonHtml}
      `,
    }));
  }

  if (leaveRequest.status !== 'pending') {
    return res.status(200).send(renderPage({
      title: `Already ${leaveRequest.status.toUpperCase()}`,
      content: `
        <div class="status-icon-wrap ${leaveRequest.status === 'approved' ? 'icon-success' : 'icon-rejected'}">
          ${leaveRequest.status === 'approved' ? '✓' : '✕'}
        </div>
        <h3 style="text-align: center; margin-bottom: 8px; text-transform: capitalize;">Request Already ${leaveRequest.status}</h3>
        <p style="text-align: center; color: #64748b; font-size: 13.5px;">
          This leave request has already been finalized as <strong>${leaveRequest.status}</strong>.
        </p>
        ${closeTabButtonHtml}
      `,
    }));
  }

  const requester = leaveRequest.user || {};
  const isApproveAction = tokenDoc.action === 'approve';
  const startDateStr = new Date(leaveRequest.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const endDateStr = new Date(leaveRequest.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const detailsHtml = `
    <table class="details-table">
      <tr>
        <td class="label-col">Requester:</td>
        <td class="val-col">${escapeHtml(requester.name || 'Employee')} <span class="pill" style="background:#f1f5f9; color:#475569;">${escapeHtml(leaveRequest.requesterRole)}</span></td>
      </tr>
      <tr>
        <td class="label-col">Employee ID:</td>
        <td class="val-col">${escapeHtml(requester.employeeId || 'N/A')}</td>
      </tr>
      <tr>
        <td class="label-col">Department &amp; Role:</td>
        <td class="val-col">${escapeHtml(requester.department || 'General')} &bull; ${escapeHtml(requester.designation || 'Staff')}</td>
      </tr>
      <tr>
        <td class="label-col">Leave Type:</td>
        <td class="val-col"><span class="pill pill-type">${escapeHtml(leaveRequest.leaveType)} leave</span></td>
      </tr>
      <tr>
        <td class="label-col">Dates:</td>
        <td class="val-col">${startDateStr} &mdash; ${endDateStr}</td>
      </tr>
      <tr>
        <td class="label-col">Duration:</td>
        <td class="val-col"><span class="pill pill-days">${leaveRequest.totalDays} ${leaveRequest.totalDays === 1 ? 'day' : 'days'}</span></td>
      </tr>
      <tr>
        <td class="label-col">Reason:</td>
        <td class="val-col" style="font-weight: 500; line-height: 1.4;">${escapeHtml(leaveRequest.reason || 'None provided')}</td>
      </tr>
      ${leaveRequest.routingReason ? `
      <tr>
        <td class="label-col">Routing Notice:</td>
        <td class="val-col" style="color: #b45309; font-size: 12px; font-weight: 600;">${escapeHtml(leaveRequest.routingReason)}</td>
      </tr>
      ` : ''}
    </table>
  `;

  let actionFormHtml = '';

  if (isApproveAction) {
    actionFormHtml = `
      <div class="action-banner banner-approve">
        <strong>Confirmation Needed:</strong> You are approving this leave request. Upon confirmation, the requester's leave balance and attendance will be updated immediately.
      </div>
      <form method="POST" action="/api/leave/action/confirm">
        <input type="hidden" name="token" value="${escapeHtml(token)}">
        <input type="hidden" name="action" value="approve">
        <button type="submit" class="btn btn-approve">✓ Confirm Leave Approval</button>
      </form>
    `;
  } else {
    actionFormHtml = `
      <div class="action-banner banner-reject">
        <strong>Confirmation Needed:</strong> You are rejecting this leave request. The requester will be notified of your decision and reason.
      </div>
      <form method="POST" action="/api/leave/action/confirm">
        <input type="hidden" name="token" value="${escapeHtml(token)}">
        <input type="hidden" name="action" value="reject">
        <div class="form-group">
          <label for="rejectionReason">Reason for Rejection <span style="color:#ef4444;">*</span></label>
          <textarea id="rejectionReason" name="rejectionReason" class="form-control" rows="3" placeholder="Explain why this leave request is being rejected..." required></textarea>
        </div>
        <button type="submit" class="btn btn-reject">✕ Confirm Leave Rejection</button>
      </form>
    `;
  }

  const approverNotice = `
    <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b; text-align: center;">
      Approving as: <strong>${escapeHtml(tokenDoc.approver?.name || 'Authorized Approver')}</strong> (${escapeHtml(tokenDoc.approverRole)})
    </div>
  `;

  return res.status(200).send(renderPage({
    title: isApproveAction ? 'Confirm Leave Approval' : 'Confirm Leave Rejection',
    content: detailsHtml + actionFormHtml + approverNotice,
  }));
};

/**
 * POST /api/leave/action/confirm
 * Processes the secure POST confirmation from the email link page.
 */
exports.confirmLeaveAction = async (req, res) => {
  const { token, action, rejectionReason } = req.body;

  if (!token) {
    return res.status(400).send(renderPage({
      title: 'Missing Token',
      content: '<p style="color:#ef4444;">Token is missing from the submission.</p>',
    }));
  }

  const chosenAction = action === 'reject' ? 'reject' : 'approve';

  const result = await leaveService.processLeaveDecision({
    tokenString: token,
    action: chosenAction,
    rejectionReason: rejectionReason || '',
  });

  if (!result.success) {
    return res.status(400).send(renderPage({
      title: 'Action Failed',
      content: `
        <div class="status-icon-wrap icon-rejected">✕</div>
        <h3 style="text-align: center; margin-bottom: 8px;">Action Could Not Be Completed</h3>
        <div class="action-banner banner-reject" style="text-align: center;">
          ${escapeHtml(result.message)}
        </div>
      `,
    }));
  }

  const leave = result.leaveRequest;
  const isApproved = result.action === 'approved';

  // Send decision email asynchronously
  try {
    const requester = await User.findById(leave.user);
    if (requester?.email) {
      sendLeaveDecisionEmail({
        leaveRequest: leave,
        requester,
        approverName: result.approverName,
        approverRole: result.approverRole,
        status: leave.status,
        rejectionReason: leave.rejectionReason,
      }).catch((e) => console.error('Decision email error:', e.message));
    }
  } catch (err) {
    console.error('Failed to notify requester:', err.message);
  }

  const successHtml = `
    <div class="status-icon-wrap ${isApproved ? 'icon-success' : 'icon-rejected'}">
      ${isApproved ? '✓' : '✕'}
    </div>
    <h3 style="text-align: center; margin-bottom: 6px;">Leave Request ${isApproved ? 'Approved' : 'Rejected'} Successfully</h3>
    <p style="text-align: center; color: #64748b; font-size: 13.5px; margin-bottom: 20px;">
      Decision recorded by <strong>${escapeHtml(result.approverName)}</strong> (${escapeHtml(result.approverRole)}).
    </p>

    <div class="action-banner ${isApproved ? 'banner-approve' : 'banner-reject'}">
      ${isApproved
        ? 'The employee/manager has been notified via email. Their leave balance and attendance have been automatically updated.'
        : `The request has been rejected. Reason provided: <em>${escapeHtml(leave.rejectionReason)}</em>`}
    </div>

    <button type="button" class="btn-close-tab" onclick="closeThisTab()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      Close This Tab
    </button>
    <div id="close-fallback-hint" class="close-fallback-hint">
      Notice: If your browser prevents automatic tab closure, press <strong>Ctrl+W</strong> (or <strong>Cmd+W</strong>) or close this tab at the top.
    </div>

    <p style="text-align: center; font-size: 12.5px; color: #94a3b8; margin-top: 14px;">
      You may now close this window safely.
    </p>
  `;

  return res.status(200).send(renderPage({
    title: isApproved ? 'Leave Approved' : 'Leave Rejected',
    content: successHtml,
  }));
};
