const nodemailer = require('nodemailer');

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}[character]));

const sendAccountCreatedEmail = async (user) => {
    const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        throw new Error('SMTP_HOST, SMTP_USER, and SMTP_PASS must be configured');
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    const name = user.name || 'there';
    await transporter.sendMail({
        from: process.env.MAIL_FROM || SMTP_USER,
        to: user.email,
        subject: 'Your Taskflow account was created',
        text: `Hi ${name},\n\nYour Taskflow account has been successfully created. You can now log in and start organizing your work.\n\nThe Taskflow team`,
        html: `<p>Hi ${escapeHtml(name)},</p><p>Your Taskflow account has been successfully created. You can now log in and start organizing your work.</p><p>The Taskflow team</p>`,
    });
};

const sendEmployeeCredentialsEmail = async (user, temporaryPassword) => {
    const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        throw new Error('SMTP_HOST, SMTP_USER, and SMTP_PASS must be configured');
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    const name = escapeHtml(user.name || 'there');
    const password = escapeHtml(temporaryPassword);
    await transporter.sendMail({
        from: process.env.MAIL_FROM || SMTP_USER,
        to: user.email,
        subject: 'Your Taskflow employee account',
        text: `Hi ${user.name || 'there'},\n\nYour Taskflow account is ready.\nEmail: ${user.email}\nTemporary password: ${temporaryPassword}\n\nPlease sign in and change this password as soon as possible.`,
        html: `<p>Hi ${name},</p><p>Your Taskflow account is ready.</p><p>Email: ${escapeHtml(user.email)}<br>Temporary password: <strong>${password}</strong></p><p>Please sign in and change this password as soon as possible.</p>`,
    });
};

module.exports = sendAccountCreatedEmail;
module.exports.sendEmployeeCredentialsEmail = sendEmployeeCredentialsEmail;