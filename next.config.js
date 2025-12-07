/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
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
          // ============================================================
          // CONTENT SECURITY POLICY (CSP)
          // ============================================================
          // Prevents XSS, code injection, and unauthorized resource loading
          {
            key: 'Content-Security-Policy',
            value: [
              // Default: only allow same-origin resources
              "default-src 'self'",

              // Scripts: Allow self, inline scripts (Next.js requires), and eval for development
              process.env.NODE_ENV === 'production'
                ? "script-src 'self' 'unsafe-inline'"
                : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",

              // Styles: Allow self and inline styles (Tailwind CSS requires)
              "style-src 'self' 'unsafe-inline'",

              // Images: Allow self, data URIs, and Supabase Storage
              "img-src 'self' data: blob: https://hvmaerptxgeldviarcuj.supabase.co",

              // Fonts: Allow self and data URIs
              "font-src 'self' data:",

              // API connections: Allow self, Supabase API, Google Gemini API, and Gemini Live WebSocket
              "connect-src 'self' https://hvmaerptxgeldviarcuj.supabase.co https://*.supabase.co https://generativelanguage.googleapis.com wss://hvmaerptxgeldviarcuj.supabase.co wss://generativelanguage.googleapis.com",

              // Forms: Only allow same-origin form submissions
              "form-action 'self'",

              // Frames: Completely disallow embedding in iframes
              "frame-ancestors 'none'",

              // Base URI: Only allow same-origin base URIs
              "base-uri 'self'",

              // Objects: Disallow plugins (Flash, Java, etc.)
              "object-src 'none'",

              // Media: Allow self and blob URLs (for video/audio)
              "media-src 'self' blob:",

              // Workers: Allow self and blob URLs
              "worker-src 'self' blob:",

              // Manifests: Allow self
              "manifest-src 'self'",
            ]
              .filter(Boolean)
              .join('; '),
          },

          // ============================================================
          // ADDITIONAL SECURITY HEADERS
          // ============================================================

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
