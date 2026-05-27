/**
 * Deadline Reminder Email Template
 * Sent when applications have upcoming deadlines
 */

import { baseTemplate } from './base';
import { DeadlineReminderEmailData } from '../types';
import { signUnsubscribeToken } from '../unsubscribe-token';

const getUrgencyEmoji = (daysUntil: number): string => {
  if (daysUntil === 1) return '🔴';
  if (daysUntil <= 3) return '🟠';
  if (daysUntil <= 7) return '🟡';
  return '🟢';
};

const getUrgencyColor = (daysUntil: number): string => {
  if (daysUntil === 1) return '#dc2626';
  if (daysUntil <= 3) return '#f97316';
  if (daysUntil <= 7) return '#eab308';
  return '#10b981';
};

export const deadlineReminderEmailTemplate = (
  data: DeadlineReminderEmailData,
  appUrl: string
) => {
  const unsubscribeUrl = `${appUrl}/api/email/unsubscribe?token=${signUnsubscribeToken({
    userId: data.userId,
    category: 'deadline_reminders',
  })}`;
  const applicationsList = data.applications
    .map(
      (app) => `
    <div class="card">
      <div class="card-title">${app.title}</div>
      <div class="card-meta">${app.company}</div>
      <p style="margin-bottom: 12px; font-size: 13px;">
        <strong>Deadline:</strong> ${app.deadline.toLocaleDateString()}<br>
        <strong style="color: ${getUrgencyColor(app.daysUntil)};">
          ${getUrgencyEmoji(app.daysUntil)} ${app.daysUntil} day${app.daysUntil !== 1 ? 's' : ''} remaining
        </strong>
      </p>
      <p style="margin: 0;">
        <a href="${appUrl}/applications" style="color: #18BB70; text-decoration: none; font-weight: 600;">
          View Application →
        </a>
      </p>
    </div>
  `
    )
    .join('');

  const content = `
    <h2>Upcoming Application Deadlines ⏰</h2>

    <p>Hi ${data.userName},</p>

    <p>
      You have <strong>${data.applications.length}</strong> application${data.applications.length !== 1 ? 's' : ''
    } with upcoming deadlines. Don't miss these opportunities!
    </p>

    <div class="divider"></div>

    ${applicationsList}

    <div class="divider"></div>

    <p style="text-align: center;">
      <a href="${appUrl}/applications" class="button">View All Applications</a>
    </p>

    <p style="font-size: 12px; color: #6b7280; margin-top: 20px; text-align: center;">
      💡 Tip: Update your notification preferences to control how often you receive deadline reminders.
    </p>
  `;

  return baseTemplate(content, undefined, unsubscribeUrl).replace(/\[\[APP_URL\]\]/g, appUrl);
};

export const deadlineReminderEmailSubject = (count: number) =>
  `${count} Application Deadline${count !== 1 ? 's' : ''} Coming Up!`;
