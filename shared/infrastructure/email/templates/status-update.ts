/**
 * Status Update Email Template
 * Sent when an application status changes
 */

import { baseTemplate } from './base';
import { StatusUpdateEmailData } from '../types';
import { signUnsubscribeToken } from '../unsubscribe-token';

const getStatusBadgeClass = (status: string): string => {
  const statusMap: Record<string, string> = {
    draft: 'status-submitted',
    submitted: 'status-submitted',
    in_review: 'status-in_review',
    interview: 'status-interview',
    offer: 'status-offer',
    rejected: 'status-rejected',
  };
  return statusMap[status] || 'status-submitted';
};

const getStatusEmoji = (status: string): string => {
  const emojiMap: Record<string, string> = {
    draft: '📝',
    submitted: '✅',
    in_review: '👀',
    interview: '🎤',
    offer: '🎉',
    rejected: '❌',
  };
  return emojiMap[status] || '📌';
};

export const statusUpdateEmailTemplate = (
  data: StatusUpdateEmailData,
  appUrl: string
) => {
  const statusBadgeClass = getStatusBadgeClass(data.newStatus);
  const statusEmoji = getStatusEmoji(data.newStatus);
  const unsubscribeUrl = `${appUrl}/api/email/unsubscribe?token=${signUnsubscribeToken({
    userId: data.userId,
    category: 'status_updates',
  })}`;

  const content = `
    <h2>Application Status Updated ${statusEmoji}</h2>

    <p>Hi ${data.userName},</p>

    <p>
      Your application for <strong>${data.applicationTitle}</strong> has been updated.
    </p>

    <div class="card">
      <div class="card-title">${data.applicationTitle}</div>
      ${data.company ? `<div class="card-meta">${data.company}</div>` : ''}
      <div class="card-meta" style="margin-bottom: 16px;">Updated on ${data.timestamp.toLocaleDateString()}</div>

      <p style="margin-bottom: 12px;">
        Status changed from:<br>
        <span class="status-badge ${getStatusBadgeClass(data.previousStatus)}">
          ${data.previousStatus.replace(/_/g, ' ')}
        </span>
        &nbsp;&nbsp;→&nbsp;&nbsp;
        <span class="status-badge ${statusBadgeClass}">
          ${data.newStatus.replace(/_/g, ' ')}
        </span>
      </p>
    </div>

    <p style="text-align: center;">
      <a href="${appUrl}/applications/${data.applicationTitle.toLowerCase().replace(/\s+/g, '-')}" class="button">
        View Application
      </a>
    </p>

    <div class="divider"></div>

    <p style="font-size: 12px; color: #6b7280; margin: 0;">
      You can manage your notification preferences in your <a href="${appUrl}/settings" style="color: #6b7280; text-decoration: underline;">settings</a>.
    </p>
  `;

  return baseTemplate(content, undefined, unsubscribeUrl).replace(/\[\[APP_URL\]\]/g, appUrl);
};

export const statusUpdateEmailSubject = (applicationTitle: string, newStatus: string) =>
  `Application Status Update: ${applicationTitle} → ${newStatus.replace(/_/g, ' ')}`;
