/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hvmaerptxgeldviarcuj.supabase.co',
      },
    ],
  },

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          // Content-Security-Policy is set per-request in middleware.ts
          // (uses a nonce + 'strict-dynamic' to drop 'unsafe-inline' for scripts).

          // Prevent clickjacking attacks
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },

          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },

          // Control referrer information leakage
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },

          // Restrict browser features (allow microphone for voice interviews)
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=()',
          },

          // Force HTTPS in production (HSTS)
          ...(process.env.NODE_ENV === 'production'
            ? [
              {
                key: 'Strict-Transport-Security',
                value: 'max-age=31536000; includeSubDomains; preload',
              },
            ]
            : []),
        ],
      },
    ]
  },
}

module.exports = nextConfig
