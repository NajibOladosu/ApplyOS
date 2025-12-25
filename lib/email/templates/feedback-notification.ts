/**
 * Feedback Notification Email Template
 * Sent to admin when a user submits feedback
 */

import { baseTemplate } from './base';

export interface FeedbackNotificationData {
  userEmail: string;
  userName: string;
  feedbackType: 'general' | 'bug' | 'feature';
  title: string;
  description: string;
  submittedAt: Date;
}

const feedbackTypeBadgeColor: Record<string, string> = {
  general: '#dbeafe',
  bug: '#fee2e2',
  feature: '#dcfce7',
};

const feedbackTypeTextColor: Record<string, string> = {
  general: '#0c4a6e',
  bug: '#7f1d1d',
  feature: '#166534',
};

const feedbackTypeLabel: Record<string, string> = {
  general: '💭 General',
  bug: '🐛 Bug Report',
  feature: '✨ Feature Request',
};

export const feedbackNotificationTemplate = (data: FeedbackNotificationData, appUrl: string) => {
  const badgeColor = feedbackTypeBadgeColor[data.feedbackType];
  const textColor = feedbackTypeTextColor[data.feedbackType];
  const label = feedbackTypeLabel[data.feedbackType];

  const content = `
    <h2>New Feedback Received</h2>

    <p>
      A user has submitted ${data.feedbackType} feedback on ApplyOS.
    </p>

    <div class="card">
      <div class="card-title">From: ${data.userName}</div>
      <div class="card-meta">${data.userEmail}</div>
      <div style="margin-bottom: 12px;">
        <span class="status-badge" style="background-color: ${badgeColor}; color: ${textColor};">
          ${label}
        </span>
      </div>
      <div class="card-title" style="margin-bottom: 12px;">${data.title}</div>
      <div style="color: #4b5563; line-height: 1.6; white-space: pre-wrap;">
        ${data.description}
      </div>
      <div class="card-meta" style="margin-top: 16px;">
        Submitted on ${data.submittedAt.toLocaleString()}
      </div>
    </div>

    <div class="divider"></div>

    <p style="text-align: center;">
      <a href="${appUrl}" class="button">View ApplyOS Dashboard</a>
    </p>

    <p style="margin-top: 30px; font-size: 12px; color: #6b7280;">
      This is an automated notification. Please do not reply to this email.
    </p>
  `;

  return baseTemplate(content).replace('[[APP_URL]]', appUrl);
};

export const feedbackNotificationSubject = (type: string) => {
  const typeLabel = feedbackTypeLabel[type] || 'Feedback';
  return `New ${typeLabel} - ApplyOS`;
};
