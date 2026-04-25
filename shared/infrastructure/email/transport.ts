/**
 * Email Transport
 * Handles SMTP connection and email sending via Nodemailer
 */

import nodemailer from 'nodemailer';
import type { Transporter, TransportOptions } from 'nodemailer';
import { getEmailConfig } from './config';

let transporter: Transporter | null = null;

/**
 * Get or create the email transporter
 * Uses connection pooling for efficiency
 */
export const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.SMTP_HOST) {
    throw new Error(
      'SMTP credentials not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in .env.local'
    );
  }

  const emailConfig = getEmailConfig();
  const transportOptions: any = {
    host: emailConfig.smtp.host,
    port: emailConfig.smtp.port,
    secure: emailConfig.smtp.secure,
    auth: {
      user: emailConfig.smtp.auth.user,
      pass: emailConfig.smtp.auth.pass,
    },
    // Connection pooling
    pool: {
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 4000, // 4 seconds
      rateLimit: 14, // max 14 messages per rateDelta
    },
  };

  transporter = nodemailer.createTransport(transportOptions as TransportOptions);

  return transporter;
};

/**
 * Verify transporter connection
 * Useful for testing configuration
 */
export const verifyTransporter = async () => {
  try {
    const transport = getTransporter();
    await transport.verify();
    console.log('✓ Email transporter verified successfully');
    return true;
  } catch (error) {
    console.error('✗ Email transporter verification failed:', error);
    return false;
  }
};

/**
 * Send email via SMTP
 */
export const sendEmailViaSMTP = async (
  to: string,
  subject: string,
  htmlBody: string,
  textBody?: string
) => {
  const transporter = getTransporter();
  const emailConfig = getEmailConfig();

  const mailOptions = {
    from: `${emailConfig.from.name} <${emailConfig.from.email}>`,
    to,
    subject,
    text: textBody || htmlBody.replace(/<[^>]*>/g, ''), // Fallback to plain text
    html: htmlBody,
  };

  return transporter.sendMail(mailOptions);
};
