/**
 * Email Configuration
 * Supports multiple providers with abstraction layer for easy swapping
 */

export const emailConfig = {
  // SMTP Configuration (Private Domain or other providers)
  smtp: {
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // Use TLS if true
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },

  // Future: SendGrid configuration
  // sendgrid: {
  //   host: 'smtp.sendgrid.net',
  //   port: 587,
  //   auth: {
  //     user: 'apikey',
  //     pass: process.env.SENDGRID_API_KEY,
  //   },
  // },

  // Email sender settings
  from: {
    name: process.env.SMTP_FROM_NAME || 'ApplyOS',
    email: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@applyos.io',
  },

  // Application settings
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  appName: 'ApplyOS',

  // Email sending settings
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds between retries
};

// Validate required environment variables
if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.SMTP_HOST) {
  console.warn(
    'Warning: SMTP_USER, SMTP_PASS, or SMTP_HOST not set. Email functionality will not work.'
  );
}

export const getEmailConfig = () => {
  return emailConfig;
};
