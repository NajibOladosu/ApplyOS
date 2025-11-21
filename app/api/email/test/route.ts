/**
 * Test Email Route
 * POST /api/email/test
 * Sends a test email to verify SMTP configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEmailDirectly } from '@/lib/email';
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/middleware/rate-limit';

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Apply rate limiting for email endpoints
    const rateLimitResponse = await rateLimitMiddleware(
      request,
      RATE_LIMITS.email,
      async () => user.id
    )
    if (rateLimitResponse) return rateLimitResponse

    // Get email from request or use user's email
    const { email } = await request.json();
    const testEmail = email || user.email;

    if (!testEmail) {
      return NextResponse.json(
        { error: 'No email address provided' },
        { status: 400 }
      );
    }

    // Send test email
    const subject = '🧪 Trackly Email Test';
    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background-color: #f9fafb;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            h1 {
              color: #00FF88;
              margin-bottom: 16px;
            }
            p {
              color: #333;
              line-height: 1.6;
              margin-bottom: 16px;
            }
            .success {
              background-color: #dcfce7;
              border: 1px solid #86efac;
              color: #166534;
              padding: 12px 16px;
              border-radius: 6px;
              margin-bottom: 20px;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              font-size: 12px;
              color: #6b7280;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🧪 Email Configuration Test</h1>

            <div class="success">
              ✓ Your email configuration is working correctly!
            </div>

            <p>
              This is a test email from <strong>Trackly</strong>. If you're seeing this,
              it means your Gmail SMTP configuration is set up correctly.
            </p>

            <p>
              You can now start receiving:
            </p>
            <ul>
              <li>Welcome emails when you sign up</li>
              <li>Application status update notifications</li>
              <li>Deadline reminder emails</li>
              <li>Weekly digest summaries</li>
            </ul>

            <p style="margin-top: 30px;">
              To manage your email preferences, visit your
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings" style="color: #00FF88; text-decoration: none;">settings page</a>.
            </p>

            <div class="footer">
              <p>
                Test sent at: <strong>${new Date().toLocaleString()}</strong><br>
                From: Trackly Email Service
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const success = await sendEmailDirectly(testEmail, subject, htmlBody);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to send test email. Check server logs for details.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Test email sent to ${testEmail}`,
        email: testEmail,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Test email route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
