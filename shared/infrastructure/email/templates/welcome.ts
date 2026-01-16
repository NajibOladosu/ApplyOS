/**
 * Welcome Email Template
 * Sent when a new user signs up
 */

import { baseTemplate } from './base';
import { WelcomeEmailData } from '../types';

export const welcomeEmailTemplate = (data: WelcomeEmailData, appUrl: string) => {
  const content = `
    <h2>Welcome to ApplyOS, ${data.userName}! 👋</h2>

    <p>
      We're excited to have you on board. ApplyOS is your AI-powered assistant for managing
      job and scholarship applications with ease.
    </p>

    <div class="divider"></div>

    <h3 style="font-size: 16px; margin-bottom: 16px; color: #1f2937;">Here's what you can do:</h3>

    <ul>
      <li><strong>Upload Documents:</strong> Upload your resume, cover letters, and other documents</li>
      <li><strong>AI Analysis:</strong> We'll automatically extract education, experience, and skills</li>
      <li><strong>Track Applications:</strong> Keep track of all your job and scholarship applications</li>
      <li><strong>Extract Questions:</strong> Auto-extract application questions from URLs</li>
      <li><strong>Get Answers:</strong> Use AI to generate contextual answers</li>
      <li><strong>Stay Updated:</strong> Get notified about upcoming deadlines and status changes</li>
    </ul>

    <div class="divider"></div>

    <p style="text-align: center;">
      <a href="${appUrl}/upload" class="button">Upload Your First Document</a>
    </p>

    <p>
      If you have any questions or need help, feel free to reach out. We're here to help you succeed!
    </p>

    <p style="margin-top: 30px; font-size: 12px; color: #6b7280;">
      Best regards,<br>
      The ApplyOS Team
    </p>
  `;

  return baseTemplate(content).replace('[[APP_URL]]', appUrl);
};

export const welcomeEmailSubject = () => 'Welcome to ApplyOS! 🎉';
