const nodemailer = require('nodemailer');

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}[character]));

const getTransporter = () => {
    const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        throw new Error('SMTP_HOST, SMTP_USER, and SMTP_PASS must be configured');
    }
    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
};

const sendAccountCreatedEmail = async (user) => {
    const transporter = getTransporter();
    const name = user.name || 'there';
    await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: user.email,
        subject: 'Your Taskflow account was created',
        text: `Hi ${name},\n\nYour Taskflow account has been successfully created. You can now log in and start organizing your work.\n\nThe Taskflow team`,
        html: `<p>Hi ${escapeHtml(name)},</p><p>Your Taskflow account has been successfully created. You can now log in and start organizing your work.</p><p>The Taskflow team</p>`,
    });
};

const sendEmployeeCredentialsEmail = async (user, temporaryPassword) => {
    const transporter = getTransporter();
    const name = escapeHtml(user.name || 'there');
    const password = escapeHtml(temporaryPassword);
    await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: user.email,
        subject: 'Your Taskflow employee account',
        text: `Hi ${user.name || 'there'},\n\nYour Taskflow account is ready.\nEmail: ${user.email}\nTemporary password: ${temporaryPassword}\n\nPlease sign in and change this password as soon as possible.`,
        html: `<p>Hi ${name},</p><p>Your Taskflow account is ready.</p><p>Email: ${escapeHtml(user.email)}<br>Temporary password: <strong>${password}</strong></p><p>Please sign in and change this password as soon as possible.</p>`,
    });
};

/**
 * Sends a Leave Approval Action Request Email to the designated approver (Manager or Admin).
 * Contains complete leave details and one-click APPROVE / REJECT secure action buttons.
 */
const sendLeaveApprovalEmail = async ({
    leaveRequest,
    requester,
    approver,
    approveUrl,
    rejectUrl,
    fallbackNotice = '',
}) => {
    const transporter = getTransporter();

    const requesterName = escapeHtml(requester.name || 'Employee');
    const employeeId = escapeHtml(requester.employeeId || 'N/A');
    const department = escapeHtml(requester.department || 'General');
    const designation = escapeHtml(requester.designation || requester.role || 'Staff');
    const requesterRole = escapeHtml(leaveRequest.requesterRole || requester.role || 'Employee');
    const formatType = (t) => {
      const s = (t || '').toLowerCase();
      if (s === 'annual') return 'ANNUAL / EARNED';
      if (s === 'sick') return 'SICK';
      if (s === 'casual' || s === 'personal' || s === 'other') return 'CASUAL';
      if (s === 'maternity_paternity' || s.includes('maternity')) return 'MATERNITY / PATERNITY';
      return s.toUpperCase();
    };
    const leaveType = escapeHtml(formatType(leaveRequest.leaveType));
    const startDateStr = new Date(leaveRequest.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const endDateStr = new Date(leaveRequest.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const totalDays = leaveRequest.totalDays || 1;
    const reason = escapeHtml(leaveRequest.reason || 'No specific reason provided.');
    const submittedAt = new Date(leaveRequest.submittedAt || Date.now()).toLocaleString('en-GB');
    const approverRole = escapeHtml(leaveRequest.approverRole || approver.role || 'Approver');
    const docInfo = leaveRequest.supportingDocument?.originalName
        ? escapeHtml(leaveRequest.supportingDocument.originalName)
        : null;

    const fallbackHtml = fallbackNotice ? `
        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px 18px; margin: 0 0 22px 0; border-radius: 6px;">
            <p style="margin: 0; color: #92400e; font-size: 13.5px; font-weight: 600; line-height: 1.5;">
                ⚠️ <strong>Administrative Routing Notice:</strong><br>
                ${escapeHtml(fallbackNotice)}
            </p>
        </div>
    ` : '';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Leave Request Action Required</title>
    </head>
    <body style="margin: 0; padding: 24px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
        <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 26px 32px; color: #ffffff;">
                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; font-weight: 700; margin-bottom: 6px;">
                    TASKFLOW &bull; HIERARCHICAL LEAVE WORKFLOW
                </div>
                <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
                    Leave Approval Action Required
                </h1>
                <p style="margin: 6px 0 0; font-size: 13px; color: #cbd5e1;">
                    Reviewing as: <strong>${approverRole}</strong>
                </p>
            </div>

            <!-- Content -->
            <div style="padding: 28px 32px;">
                ${fallbackHtml}

                <p style="margin: 0 0 20px 0; font-size: 14.5px; line-height: 1.6; color: #334155;">
                    Hello <strong>${escapeHtml(approver.name || 'Approver')}</strong>,<br>
                    <strong>${requesterName}</strong> (${requesterRole}) has submitted a leave request that requires your review and decision.
                </p>

                <!-- Details Card -->
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px 22px; margin-bottom: 26px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; width: 38%; font-weight: 600;">Requester:</td>
                            <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${requesterName} <span style="font-size: 11.5px; font-weight: 500; color: #64748b;">(${requesterRole})</span></td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Employee ID:</td>
                            <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${employeeId}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Department:</td>
                            <td style="padding: 6px 0; color: #0f172a;">${department} &bull; ${designation}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Leave Type:</td>
                            <td style="padding: 6px 0;">
                                <span style="background-color: #e0f2fe; color: #0369a1; padding: 3px 9px; border-radius: 6px; font-weight: 700; font-size: 12px;">${leaveType} LEAVE</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Leave Period:</td>
                            <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${startDateStr} &mdash; ${endDateStr}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Duration:</td>
                            <td style="padding: 6px 0; color: #059669; font-weight: 800; font-size: 14px;">${totalDays} ${totalDays === 1 ? 'Day' : 'Days'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; font-weight: 600; vertical-align: top;">Reason:</td>
                            <td style="padding: 6px 0; color: #334155; line-height: 1.5;">${reason}</td>
                        </tr>
                        ${docInfo ? `
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Supporting Doc:</td>
                            <td style="padding: 6px 0; color: #2563eb; font-weight: 600;">📎 ${docInfo}</td>
                        </tr>
                        ` : ''}
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Submitted On:</td>
                            <td style="padding: 6px 0; color: #64748b; font-size: 12px;">${submittedAt}</td>
                        </tr>
                    </table>
                </div>

                <!-- Action CTA Buttons -->
                <div style="text-align: center; margin: 30px 0 20px;">
                    <p style="margin: 0 0 16px 0; font-size: 13.5px; font-weight: 700; color: #0f172a;">
                        Choose your decision below directly from this email:
                    </p>
                    <div style="display: inline-block; width: 100%; max-width: 480px;">
                        <a href="${approveUrl}" 
                           style="display: inline-block; width: 44%; padding: 13px 0; margin-right: 4%; background-color: #10b981; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 14px; border-radius: 8px; text-align: center; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);">
                            ✓ APPROVE LEAVE
                        </a>
                        <a href="${rejectUrl}" 
                           style="display: inline-block; width: 44%; padding: 13px 0; background-color: #ef4444; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 14px; border-radius: 8px; text-align: center; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.35);">
                            ✕ REJECT LEAVE
                        </a>
                    </div>
                </div>

                <!-- Security Disclaimers -->
                <div style="margin-top: 28px; padding-top: 18px; border-top: 1px solid #f1f5f9; font-size: 11.5px; color: #94a3b8; line-height: 1.5;">
                    <p style="margin: 0 0 4px 0;">
                        🔒 <strong>Zero-Login Security:</strong> This email contains single-use, cryptographically verified action tokens. Once you submit your decision, the links are automatically invalidated.
                    </p>
                    <p style="margin: 0;">
                        Links are valid for 7 days. If you suspect an error, contact your system administrator.
                    </p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    const text = `
LEAVE APPROVAL ACTION REQUIRED (Taskflow)
----------------------------------------
Requester: ${requester.name} (${leaveRequest.requesterRole || 'Employee'})
Employee ID: ${requester.employeeId || 'N/A'}
Department: ${requester.department || 'General'}
Leave Type: ${leaveRequest.leaveType}
Dates: ${startDateStr} - ${endDateStr} (${totalDays} days)
Reason: ${leaveRequest.reason || 'None'}
${fallbackNotice ? `\n[ROUTING NOTICE]: ${fallbackNotice}\n` : ''}

To APPROVE this request:
${approveUrl}

To REJECT this request:
${rejectUrl}
    `.trim();

    await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: approver.email,
        subject: `[Action Required] Leave Request: ${requester.name} (${totalDays} ${totalDays === 1 ? 'day' : 'days'})`,
        text,
        html,
    });
};

/**
 * Sends a Decision Notification Email to the Requester.
 */
const sendLeaveDecisionEmail = async ({
    leaveRequest,
    requester,
    approverName,
    approverRole,
    status,
    rejectionReason,
}) => {
    const transporter = getTransporter();

    const isApproved = status === 'approved';
    const statusText = isApproved ? 'Approved' : 'Rejected';
    const statusColor = isApproved ? '#10b981' : '#ef4444';
    const startDateStr = new Date(leaveRequest.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const endDateStr = new Date(leaveRequest.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const totalDays = leaveRequest.totalDays || 1;

    const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 24px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
            <div style="background-color: ${statusColor}; padding: 22px 28px; color: #ffffff;">
                <h2 style="margin: 0; font-size: 20px; font-weight: 800;">Leave Request ${statusText}</h2>
                <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.95;">Decided by ${escapeHtml(approverName)} (${escapeHtml(approverRole)})</p>
            </div>
            <div style="padding: 24px 28px;">
                <p style="margin: 0 0 16px; font-size: 14.5px; color: #334155;">
                    Hi <strong>${escapeHtml(requester.name || 'there')}</strong>,
                </p>
                <p style="margin: 0 0 18px; font-size: 14px; color: #334155; line-height: 1.5;">
                    Your request for <strong>${escapeHtml(leaveRequest.leaveType)} leave</strong> from <strong>${startDateStr}</strong> to <strong>${endDateStr}</strong> (${totalDays} ${totalDays === 1 ? 'day' : 'days'}) has been <strong style="color: ${statusColor}; text-transform: uppercase;">${statusText}</strong>.
                </p>

                ${!isApproved && rejectionReason ? `
                <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
                    <strong style="color: #991b1b; font-size: 13px; display: block; margin-bottom: 4px;">Reason for Rejection:</strong>
                    <p style="margin: 0; color: #b91c1c; font-size: 13px; line-height: 1.4;">${escapeHtml(rejectionReason)}</p>
                </div>
                ` : ''}

                ${isApproved ? `
                <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
                    <strong style="color: #065f46; font-size: 13px; display: block; margin-bottom: 4px;">Leave Balance & Attendance Updated:</strong>
                    <p style="margin: 0; color: #047857; font-size: 13px; line-height: 1.4;">
                        Your leave balance has been updated, and attendance records for the requested period are now marked as <strong>On Leave</strong>.
                    </p>
                </div>
                ` : ''}

                <p style="margin: 0; font-size: 12.5px; color: #64748b;">
                    You can view your complete leave history and updated balance anytime on the Taskflow portal.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: requester.email,
        subject: `Your Leave Request has been ${statusText} (${leaveRequest.leaveType} leave)`,
        text: `Hi ${requester.name},\n\nYour leave request for ${leaveRequest.leaveType} leave (${startDateStr} - ${endDateStr}) has been ${statusText} by ${approverName} (${approverRole}).\n${rejectionReason ? `Reason: ${rejectionReason}\n` : ''}`,
        html,
    });
};

module.exports = sendAccountCreatedEmail;
module.exports.sendAccountCreatedEmail = sendAccountCreatedEmail;
module.exports.sendEmployeeCredentialsEmail = sendEmployeeCredentialsEmail;
module.exports.sendLeaveApprovalEmail = sendLeaveApprovalEmail;
module.exports.sendLeaveDecisionEmail = sendLeaveDecisionEmail;
