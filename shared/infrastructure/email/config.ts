/**
 * Email Configuration
 * Supports multiple providers with abstraction layer for easy swapping
 */

export const getEmailConfig = () => {
  const config = {
    // SMTP Configuration (Private Domain or other providers)
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com', // Default to gmail if not specified, common fallback
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true', // Use TLS if true
      auth: {
        user: process.env.SMTP_USER || process.env.GMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD,
      },
    },

    // DKIM Configuration for better deliverability
    dkim: {
      domainName: process.env.DKIM_DOMAIN,
      keySelector: process.env.DKIM_SELECTOR,
      privateKey: process.env.DKIM_PRIVATE_KEY,
    },

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

  return config;
};

// For backward compatibility and convenience
export const emailConfig = getEmailConfig();

// Validate required environment variables - only warn if not in a function call to avoid spam
if (typeof window === 'undefined' && (!process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.SMTP_HOST)) {
  // Only log this once during module load if possible
  // console.warn('Warning: SMTP credentials not fully set in process.env');
}
