/**
 * Base email template wrapper
 * All emails should be wrapped with this for consistent styling
 */

export const baseTemplate = (content: string, year: number = new Date().getFullYear()) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ApplyOS</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f9fafb;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background-color: #151515;
      background-image: linear-gradient(135deg, #151515 0%, #1A1A1A 100%);
      color: #ffffff;
      padding: 40px 20px;
      text-align: center;
      border-radius: 12px 12px 0 0;
      border-bottom: 1px solid #333333;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin: 10px 0 0 0;
      color: #00FF88;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    }
    .logo-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .content {
      padding: 40px 30px;
    }
    .footer {
      background-color: #f3f4f6;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
    }
    .button {
      display: inline-block;
      background-color: #00FF88;
      color: #000;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      margin: 20px 0;
      transition: background-color 0.2s;
    }
    .button:hover {
      background-color: #00CC66;
    }
    h2 {
      font-size: 20px;
      margin-bottom: 16px;
      color: #1f2937;
    }
    p {
      margin-bottom: 16px;
      color: #4b5563;
    }
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-submitted {
      background-color: #dbeafe;
      color: #0c4a6e;
    }
    .status-in_review {
      background-color: #fef3c7;
      color: #92400e;
    }
    .status-interview {
      background-color: #dcfce7;
      color: #166534;
    }
    .status-offer {
      background-color: #d1fae5;
      color: #065f46;
    }
    .status-rejected {
      background-color: #fee2e2;
      color: #7f1d1d;
    }
    .divider {
      height: 1px;
      background-color: #e5e7eb;
      margin: 30px 0;
    }
    .card {
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .card-title {
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 8px;
    }
    .card-meta {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 12px;
    }
    ul {
      margin-left: 20px;
      margin-bottom: 16px;
    }
    li {
      margin-bottom: 8px;
      color: #4b5563;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-container">
        <img src="[[APP_URL]]/logo.svg" alt="ApplyOS" width="40" height="40" style="display: block; border: none;">
        <h1>ApplyOS</h1>
      </div>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>© ${year} ApplyOS. All rights reserved.</p>
      <p>
        <a href="[[APP_URL]]/settings" style="color: #6b7280; text-decoration: none;">Manage email preferences</a>
      </p>
    </div>
  </div>
</body>
</html>
`;
