/**
 * Weekly Digest Email Template
 * Sent every week with summary of applications and upcoming deadlines
 */

import { baseTemplate } from './base';
import { WeeklyDigestEmailData } from '../types';

export const weeklyDigestEmailTemplate = (
  data: WeeklyDigestEmailData,
  appUrl: string
) => {
  const weekRange = `${data.weekStart.toLocaleDateString()} - ${data.weekEnd.toLocaleDateString()}`;

  const applicationsHtml =
    data.applications.length > 0
      ? `
    <h3 style="font-size: 16px; margin-bottom: 16px; color: #1f2937;">Recent Applications</h3>
    ${data.applications
        .map(
          (app) => `
      <div class="card">
        <div class="card-title">${app.title}</div>
        <div class="card-meta">${app.company}</div>
        <p style="margin: 0; font-size: 12px;">
          <span class="status-badge status-${app.status.toLowerCase().replace(/ /g, '_')}">
            ${app.status}
          </span>
          &nbsp;&nbsp;Updated ${new Date(app.updatedAt).toLocaleDateString()}
        </p>
      </div>
    `
        )
        .join('')}
  `
      : '<p style="color: #6b7280; font-style: italic;">No applications updated this week</p>';

  const deadlinesHtml =
    data.upcomingDeadlines.length > 0
      ? `
    <h3 style="font-size: 16px; margin-bottom: 16px; color: #1f2937; margin-top: 24px;">
      Upcoming Deadlines
    </h3>
    ${data.upcomingDeadlines
        .map(
          (deadline) => `
      <div class="card">
        <div class="card-title">${deadline.title}</div>
        <div class="card-meta">${deadline.company}</div>
        <p style="margin: 0; font-size: 12px;">
          <strong>Deadline:</strong> ${deadline.deadline.toLocaleDateString()}<br>
          <strong style="color: ${deadline.daysUntil <= 3 ? '#dc2626' : '#f97316'
            };">
            ⏳ ${deadline.daysUntil} days remaining
          </strong>
        </p>
      </div>
    `
        )
        .join('')}
  `
      : '';

  const content = `
    <h2>Your Weekly Summary 📊</h2>

    <p>Hi ${data.userName},</p>

    <p>
      Here's a quick summary of your job and scholarship applications for the week of <strong>${weekRange}</strong>.
    </p>

    <div class="divider"></div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 30px;">
      <div class="card" style="margin-bottom: 0;">
        <div style="font-size: 24px; font-weight: 700; color: #00FF88; margin-bottom: 4px;">
          ${data.totalApplications}
        </div>
        <div style="font-size: 12px; color: #6b7280;">Total Applications</div>
      </div>

      <div class="card" style="margin-bottom: 0;">
        <div style="font-size: 24px; font-weight: 700; color: #00FF88; margin-bottom: 4px;">
          ${data.newApplicationsThisWeek}
        </div>
        <div style="font-size: 12px; color: #6b7280;">New This Week</div>
      </div>
    </div>

    ${applicationsHtml}

    ${deadlinesHtml}

    <div class="divider"></div>

    <p style="text-align: center;">
      <a href="${appUrl}/applications" class="button">View All Applications</a>
    </p>

    <p style="font-size: 12px; color: #6b7280; margin-top: 20px;">
      📈 Want to add more applications? <a href="${appUrl}/applications" style="color: #6b7280; text-decoration: underline;">Create a new application</a> to stay organized.
    </p>
  `;

  return baseTemplate(content).replace('[[APP_URL]]', appUrl);
};

export const weeklyDigestEmailSubject = () => 'Your ApplyOS Weekly Summary 📊';
