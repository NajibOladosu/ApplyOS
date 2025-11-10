/**
 * Email Configuration
 * Supports multiple providers with abstraction layer for easy swapping
 */

export const emailConfig = {
  // Gmail SMTP Configuration
  gmail: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use TLS (not SSL)
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
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
    name: 'Trackly',
    email: process.env.GMAIL_USER || 'noreply@trackly.app',
  },

  // Application settings
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  appName: 'Trackly',

  // Email sending settings
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds between retries
};

// Validate required environment variables
if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
  console.warn(
    'Warning: GMAIL_USER or GMAIL_APP_PASSWORD not set. Email functionality will not work.'
  );
}

export const getEmailConfig = () => {
  return emailConfig;
};
