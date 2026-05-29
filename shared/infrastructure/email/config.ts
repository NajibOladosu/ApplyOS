/**
 * Email Configuration
 * Supports multiple providers with abstraction layer for easy swapping
 */

/**
 * Sanitize an SMTP credential value coming from the environment.
 *
 * Secret managers and `.env` files frequently inject stray whitespace
 * (trailing newlines, surrounding quotes) which corrupts the AUTH PLAIN
 * payload and surfaces as a `535 5.7.8 authentication failed` error even
 * when the credential itself is correct. We strip that noise here.
 */
const sanitizeCredential = (value?: string | null): string | undefined => {
  if (value == null) return undefined;

  // Trim outer whitespace and any wrapping quotes that slipped in from .env files.
  let cleaned = value.trim().replace(/^['"]|['"]$/g, '').trim();

  // App passwords (Gmail, iCloud, etc.) are displayed in groups separated by
  // spaces (e.g. "abcd efgh ijkl mnop") but the actual secret contains no
  // spaces. Pasting them verbatim is a very common cause of 535 failures, so
  // collapse internal whitespace away.
  cleaned = cleaned.replace(/\s+/g, '');

  return cleaned.length > 0 ? cleaned : undefined;
};

export const getEmailConfig = () => {
  const port = parseInt(process.env.SMTP_PORT || '587', 10);

  // Derive `secure` from the port unless explicitly overridden. Port 465 uses
  // implicit TLS (secure=true); 587/25 use STARTTLS (secure=false). A mismatch
  // here is another frequent cause of auth/handshake failures.
  const secure =
    process.env.SMTP_SECURE != null && process.env.SMTP_SECURE !== ''
      ? process.env.SMTP_SECURE === 'true'
      : port === 465;

  const config = {
    // SMTP Configuration (Private Domain or other providers)
    smtp: {
      host: (process.env.SMTP_HOST || 'smtp.gmail.com').trim(), // Default to gmail if not specified, common fallback
      port,
      secure,
      auth: {
        user: sanitizeCredential(process.env.SMTP_USER || process.env.GMAIL_USER),
        pass: sanitizeCredential(process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD),
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
      name: (process.env.SMTP_FROM_NAME || 'ApplyOS').trim(),
      email:
        process.env.SMTP_FROM_EMAIL?.trim() ||
        sanitizeCredential(process.env.SMTP_USER) ||
        'noreply@applyos.io',
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
