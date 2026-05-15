/* Notification Service (Email) */
import nodemailer from 'nodemailer';
import db from '../db.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const TEMPLATES = {
  request_pending: (user, request) => ({
    subject: `Request Pending Review: ${request.title}`,
    html: `
      <h2>Request Pending Review</h2>
      <p>Hi ${user.name},</p>
      <p>Your request has been submitted and is pending approval:</p>
      <p><strong>${request.title}</strong></p>
      <p>Expected decision: within 24 hours</p>
      <p><a href="${process.env.FRONTEND_URL}/requests/${request.id}">View Request</a></p>
    `,
  }),

  request_approved: (user, request) => ({
    subject: `✓ Approved: ${request.title}`,
    html: `
      <h2>Request Approved</h2>
      <p>Hi ${user.name},</p>
      <p>Your request has been approved:</p>
      <p><strong>${request.title}</strong></p>
      <p>Provisioning will begin immediately.</p>
    `,
  }),

  request_denied: (user, request, notes) => ({
    subject: `✗ Denied: ${request.title}`,
    html: `
      <h2>Request Denied</h2>
      <p>Hi ${user.name},</p>
      <p>Your request could not be approved:</p>
      <p><strong>${request.title}</strong></p>
      <p><strong>Reason:</strong> ${notes || 'Policy violation'}</p>
      <p><a href="${process.env.FRONTEND_URL}/requests/${request.id}">View Details</a></p>
    `,
  }),

  exception_created: (manager, request) => ({
    subject: `New Exception: ${request.title}`,
    html: `
      <h2>Exception Review Required</h2>
      <p>Hi ${manager.name},</p>
      <p>A policy exception requires your review:</p>
      <p><strong>${request.title}</strong></p>
      <p><a href="${process.env.FRONTEND_URL}/exceptions">Review Now</a></p>
    `,
  }),

  user_invited: (email, tempPassword) => ({
    subject: 'Welcome to Orbit Resolve',
    html: `
      <h2>Welcome!</h2>
      <p>You've been invited to Orbit Resolve.</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Temporary Password:</strong> ${tempPassword}</p>
      <p><a href="${process.env.FRONTEND_URL}/login">Sign In</a></p>
    `,
  }),
};

export const sendEmail = async (to, template, data) => {
  try {
    const emailData = TEMPLATES[template](data.user, data.request, data.notes);
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@orbitresolve.com',
      to,
      ...emailData,
    });
  } catch (err) {
    console.error('Email send failed:', err);
  }
};

export const notifyRequestCreated = async (request) => {
  const user = await db.query('SELECT * FROM users WHERE id = $1', [request.user_id]);
  const managers = await db.query(
    'SELECT email, name FROM users WHERE org_id = $1 AND role IN ($2, $3)',
    [request.org_id, 'manager', 'admin']
  );

  for (const manager of managers.rows) {
    await sendEmail(manager.email, 'exception_created', {
      user: manager,
      request,
    });
  }
};

export const notifyRequestApproved = async (request) => {
  const user = await db.query('SELECT * FROM users WHERE id = $1', [request.user_id]);
  await sendEmail(user.rows[0].email, 'request_approved', {
    user: user.rows[0],
    request,
  });
};

export const notifyRequestDenied = async (request, notes) => {
  const user = await db.query('SELECT * FROM users WHERE id = $1', [request.user_id]);
  await sendEmail(user.rows[0].email, 'request_denied', {
    user: user.rows[0],
    request,
    notes,
  });
};
