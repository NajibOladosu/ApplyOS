/**
 * Email Transport
 * Handles SMTP connection and email sending via Nodemailer
 */

import nodemailer from 'nodemailer';
import type { Transporter, TransportOptions } from 'nodemailer';
import { emailConfig } from './config';

let transporter: Transporter | null = null;

/**
 * Get or create the email transporter
 * Uses connection pooling for efficiency
 */
export const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error(
      'Gmail credentials not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env.local'
    );
  }

  transporter = nodemailer.createTransport({
    host: emailConfig.gmail.host,
    port: emailConfig.gmail.port,
    secure: emailConfig.gmail.secure,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    // Connection pooling
    pool: {
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 4000, // 4 seconds
      rateLimit: 14, // max 14 messages per rateDelta
    },
  } as TransportOptions);

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

  const mailOptions = {
    from: `${emailConfig.from.name} <${emailConfig.from.email}>`,
    to,
    subject,
    text: textBody || htmlBody.replace(/<[^>]*>/g, ''), // Fallback to plain text
    html: htmlBody,
  };

  return transporter.sendMail(mailOptions);
};
