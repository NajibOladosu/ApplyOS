# <img src="public/logo.svg" width="32" height="32" align="center" /> ApplyOS - AI-Powered Application & Interview Manager

<div align="center">
  <img src="https://img.shields.io/badge/Next.js-16.1.1-black?style=for-the-badge" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.4.0-blue?style=for-the-badge" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-Enabled-green?style=for-the-badge" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tailwind-3.4.3-38bdf8?style=for-the-badge" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Gemini-3.0%20Flash-orange?style=for-the-badge" alt="Gemini AI" />
  <img src="https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel&style=for-the-badge" alt="Vercel" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License" />
</div>

<br />

> Your all-in-one platform for job applications with AI-powered document analysis, interview practice, and intelligent career tracking

ApplyOS is a comprehensive full-stack web application that revolutionizes how you manage your career journey. From AI-powered resume analysis and cover letter generation to realistic interview practice with real-time feedback, ApplyOS helps you land your dream job with confidence.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Key Features Deep Dive](#key-features-deep-dive)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Contributing](#contributing)
- [License](#license)

## Features

### AI-Powered Document Analysis

- **Intelligent Text Extraction** - Advanced PDF parsing with automatic text extraction and caching
- **Structured Data Extraction** - AI extracts education, work experience, skills, achievements, and certifications from resumes
- **Smart Document Reports** - Comprehensive AI-generated analysis of document content and quality
- **AI-Powered Summaries** - Concise one-sentence summaries for quick document identification
- **Cached Processing** - Text extracted once and cached for instant future operations
- **Real-time Status Tracking** - Monitor analysis progress (not_analyzed, pending, success, failed)
- **On-Demand Regeneration** - Re-analyze documents and regenerate summaries anytime
- **Multi-format Support** - PDF, TXT, JSON, and DOCX files supported

### Interview Practice System

- **Multiple Interview Modes**:
  - **Text-based Q&A** - Practice with typed responses
  - **Voice Interviews** - Record voice answers with automatic transcription
  - **Live Conversational AI** - Real-time two-way conversations with AI interviewer
  - **Resume Grilling** - AI challenges you on specific resume claims
  - **Company-specific Prep** - Tailored questions based on target company

- **AI-Generated Questions** - Contextual questions based on job description and your resume
- **Comprehensive Scoring** - Detailed feedback on:
  - Overall answer quality (0-10 score)
  - Clarity and structure
  - Relevance to question
  - Depth and detail
  - Confidence and delivery

- **Interview Analytics** - Track your progress over time:
  - Performance trends by category (behavioral, technical, etc.)
  - Score improvements across sessions
  - Strengths and weaknesses identification
  - Category-specific breakdowns

- **Detailed Reports** - Post-interview analysis with:
  - Question-by-question feedback
  - Strengths and areas for improvement
  - Actionable suggestions
  - Overall performance summary

### Application Management

- **Complete Lifecycle Tracking** - Manage applications from draft to final decision
- **Smart Status Workflow** - Track progress through:
  - Draft → Submitted → In Review → Interview → Offer/Rejected
- **Priority Management** - Categorize as low, medium, or high priority
- **Deadline Monitoring** - Set and track application deadlines with visual alerts
- **Rich Notes System** -
  - Full rich text editor with formatting
  - Timeline and card views
  - Timestamps for all updates
- **Auto-Save System** - Real-time saving of status changes, documents, and notes
- **Bulk Import** - Import multiple applications via CSV template
- **Status History** - Automatic tracking of all status changes with timestamps
- **Linked Documents** - Associate resumes and cover letters with applications
- **Company Information** - Track company names, URLs, and application portals

### AI Cover Letter Generation

- **Intelligent Generation** - AI creates tailored cover letters based on:
  - Your resume data
  - Job description
  - Company information
  - Your career goals
- **Manual Editing** - Edit and customize AI-generated letters
- **Template Storage** - Save both AI and manual versions

### Analytics & Insights

- **Application Metrics**:
  - Total applications submitted
  - Success rate and conversion funnel
  - Average time in each stage
  - Application status distribution

- **Visual Analytics**:
  - Sankey flow diagrams for status transitions
  - Timeline charts for application progress
  - Conversion funnels
  - Category breakdowns

- **Interview Analytics**:
  - Performance trends over time
  - Category-specific scores
  - Improvement tracking
  - Strengths and weaknesses patterns

### Email & Notifications

- **Smart Notifications**:
  - Status change alerts
  - Upcoming deadline reminders
  - Interview feedback notifications

- **Automated Emails**:
  - Welcome emails for new users
  - Deadline reminders (7, 3, and 1 day before)
  - Weekly digest of application activity
  - Status update notifications

- **Email Queue System** - Reliable delivery with retry mechanism
- **SMTP Integration** - Standard SMTP support for private domains and providers

### Authentication & Security

- **Multi-Provider Authentication**:
  - Email/password with verification
  - Google OAuth with seamless integration

- **Secure Blog Platform**:
  - **MDX-Powered Blog** - Rich content authoring with React components
  - **SEO Optimized** - Automatic metadata, sitemaps, and canonical tags
  - **Subdomain Routing** - `blog.applyos.io` integration via middleware

- **Email Verification** - Required for all signup methods with:
  - Automatic verification email sending
  - Beautiful verification check pages
  - Rate-limited resend (5-minute cooldown)
  - Cross-provider account linking

- **Security Features**:
  - Password leak detection (HaveIBeenPwned integration)
  - Row-Level Security (RLS) on all tables
  - Protected API routes with middleware
  - Secure file storage with access control
  - Rate limiting on sensitive endpoints
  - HTTP-only cookies for session management

- **Account Management**:
  - User avatars with upload support
  - Profile customization
  - Complete account deletion with cascade
  - Data privacy controls

### User Interface

- **Modern Design**:
  - Clean, intuitive interface built with shadcn/ui
  - Responsive design for desktop, tablet, and mobile
  - **Theme Support** - Seamless Light and Dark mode toggle with persisted preference
  - **Premium Aesthetics** - Glassmorphism, tailored HSL color palettes, and polished typography

- **Advanced Interactions**:
  - **AI Orb Interface** - Dynamic, reactive 3D orb visualizing AI voice activity and user speech
  - **Voice-First Design** - Hands-free interview practice with real-time feedback
  - Framer Motion-powered animations
  - Real-time toast notifications
  - Loading states and progress indicators
  - Drag-and-drop file uploads

- **Rich Text Editing** - TipTap editor with:
  - Formatting toolbar
  - Link support
  - Placeholder text
  - Auto-save capabilities

### Marketing & Growth (Beta)

- **Marketing Content Calendar** - System for planning social media posts (LinkedIn, Twitter)
- **ApplyOS Social Media Manager** - n8n workflow for automated content curation and scheduling
- **AI-Powered Screenshot Analysis** - Automatic feature extraction and analysis from screenshots
- **n8n Automation Workflows** - Integrated workflows for:
  - Automated social content generation using Gemini AI
  - Image generation for marketing posts
  - Multi-platform publishing triggers
- **Dynamic Asset Management** - Marketing bucket for screenshots and promotional assets

### Additional Features

- **Feedback System** - Submit bug reports, feature requests, and general feedback
- **AI Retry Queue** - Automatic retry for rate-limited AI operations
- **Cron Jobs** - Scheduled tasks for:
  - Deadline reminders
  - Weekly digests
  - Notification cleanup
  - AI task retries
- **Advanced Error Handling** - Graceful fallbacks and user-friendly error messages
- **Performance Optimization** - Caching, lazy loading, and optimized queries

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 18+** and npm
- **Git** for version control
- **Supabase Account** - [Sign up here](https://supabase.com)
- **Google Gemini API Key** (required for AI features) - [Get it here](https://ai.google.dev/gemini-api/docs/api-key)

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/NajibOladosu/ApplyOS.git
   cd ApplyOS
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

   This will install all required packages including Next.js, React, Supabase client, Gemini AI SDK, and all UI dependencies.

## Configuration

1. **Create environment file**

   Create a `.env.local` file in the root directory:

   ```env
   # Supabase Configuration (Required)
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

   # AI Configuration (Required for document analysis and interview features)
   GEMINI_API_KEY=your-google-gemini-api-key

   # Email Configuration (Optional - for email notifications)
   SMTP_HOST=mail.yourdomain.com
   SMTP_PORT=587
   SMTP_USER=noreply@yourdomain.com
   SMTP_PASS=your-private-email-password
   SMTP_SECURE=false
   SMTP_FROM_NAME=ApplyOS
   SMTP_FROM_EMAIL=noreply@yourdomain.com
   ADMIN_EMAIL=admin@yourdomain.com
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # Cron Jobs (Optional - for scheduled tasks)
   CRON_SECRET=your-secret-key-for-cron-jobs

   # Advanced Configuration (Optional)
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. **Get Supabase credentials**

   - Go to your [Supabase Dashboard](https://supabase.com/dashboard)
   - Select your project or create a new one
   - Navigate to Settings > API
   - Copy the `URL` and `anon/public` key

3. **Get Google Gemini API key** (required)

   - Visit [Google AI Studio](https://ai.google.dev/gemini-api/docs/api-key)
   - Create a new API key
   - Copy and add to `.env.local`
   - Note: Gemini 2.5 and 3.0 models are used for optimized performance

4. **Set up SMTP Email** (optional - for email notifications)

   To enable email notifications:
   - Obtain SMTP settings from your email provider (host, port, user, password)
   - Add the `SMTP_*` variables to `.env.local`

## Database Setup

### Important: Migration Order

Migrations must be applied in the exact order listed below. Each migration builds upon previous ones.

### Step 1: Apply Migrations

In your Supabase project's SQL Editor, run the following migrations **in order**:

1. **Core Schema** (`001_initial_schema.sql`)
   - Creates users, applications, documents, questions, notifications tables
   - Sets up RLS policies and triggers
   - Establishes core relationships

2. **Document Analysis** (`002_add_document_analysis_fields.sql`)
   - Adds AI analysis status tracking
   - Adds summary and error logging fields

3. **Text Extraction Optimization** (`003_add_extracted_text_column.sql`)
   - Adds cached text extraction
   - Optimizes for AI processing speed

4. **Application Documents** (`004_create_application_documents.sql`)
   - Links documents to applications
   - Enables document association tracking

5. **Email Tracking** (`004_add_email_tracking.sql`)
   - Adds email queue for reliable delivery
   - Adds email status tracking

6. **Job Description** (`005_rename_notes_to_job_description.sql`)
   - Renames notes field to job_description
   - Improves schema clarity

7. **Email Verification** (`006_add_email_verification.sql`)
   - Adds email verification system
   - Required for OAuth flows

8. **Auto Notifications** (`007_disable_auto_status_notification.sql`)
   - Disables automatic status notifications
   - Gives user control over notifications

9. **Document Reports** (`008_rename_summary_to_report.sql`)
   - Renames summary to report for clarity
   - Updates document schema

10. **Cover Letter Fields** (`008_add_cover_letter_fields.sql`)
    - Adds AI and manual cover letter fields
    - Enables cover letter generation

11. **Feedback System** (`009_add_feedback_table.sql`)
    - Creates feedback table
    - Enables user feedback submission

12. **AI Retry Queue** (`010_add_ai_retry_queue.sql`)
    - Creates retry queue for rate-limited AI calls
    - Improves reliability

13. **Company Field** (`011_add_company_field.sql`)
    - Adds company name to applications
    - Improves organization

14. **Application Notes RLS** (`012_application_notes_rls_documentation.sql`)
    - Adds secure application notes table
    - Sets up RLS policies

15. **Storage Bucket Policies** (`013_add_storage_bucket_policies.sql`)
    - Secures document storage bucket
    - Adds file size and type restrictions

16. **Function Security** (`014_fix_function_search_path_security.sql`)
    - Fixes search_path injection vulnerabilities
    - Secures trigger functions

17. **Interview Tables** (`015_create_interview_tables.sql`)
    - Creates interview practice system
    - Sets up sessions, questions, answers, analytics

18. **Conversation Support** (`016_add_conversation_support.sql`)
    - Adds conversational interview mode
    - Enables real-time AI conversations

19. **Interview Function Security** (`017_fix_interview_function_search_path.sql`)
    - Secures interview trigger functions
    - Prevents injection attacks
    -   Secures interview trigger functions
    -   Prevents injection attacks

20. **RLS Optimization** (`018_optimize_rls_policies.sql`)
    -   Optimizes Row Level Security policies
    -   Improves query performance

21. **Marketing Automation** (`019_create_marketing_content_calendar.sql`)
    -   Creates marketing content calendar
    -   Enables social media content planning
    -   Tracks content status and copy

22. **Screenshot Metadata** (`020_create_screenshot_metadata.sql`)
    -   Adds storage for AI-analyzed screenshot metadata
    -   Tracks features and categories for marketing assets

23. **Screenshot Trigger** (`021_create_screenshot_trigger.sql`)
    -   Enables automated analysis when screenshots are uploaded
    -   Integrates Supabase Storage with Edge Functions

### Step 2: Create Storage Bucket

1.  In your Supabase Dashboard, go to **Storage**
2.  Click **Create a new bucket**
3.  Name it `documents`
4.  Set the bucket to **Private** (security best practice)
5.  Save the bucket

The RLS policies from migration 13 will handle access control.

### Step 3: Verify Setup

Run these queries in the SQL Editor to verify:

```sql
-- Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true;

-- Check storage bucket
SELECT * FROM storage.buckets WHERE name = 'documents';
```

## Running the Application

### Development Mode

Start the development server:

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

### Production Build

Build the application for production:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

### Linting

Run ESLint to check code quality:

```bash
npm run lint
```

## Key Features Deep Dive

### Document Processing Pipeline

1.  **Upload Flow**:
    -   User uploads PDF/TXT/DOCX via drag-and-drop
    -   File validated (type, size)
    -   Content extracted using pdf2json (PDFs) or mammoth (DOCX)
    -   File stored in Supabase Storage
    -   Metadata and extracted text saved to database
    -   AI analyzes content and extracts structured data
    -   Status updated (success/failed)

2.  **AI Analysis**:
    -   Uses cached extracted text (instant!)
    -   Gemini 2.5 & 3.0 models extract:
        -   Education (degree, institution, dates)
        -   Experience (company, role, dates, achievements)
        -   Skills (technical, soft, tools)
        -   Certifications
    -   Results stored in JSONB format
    -   Can be regenerated on-demand

3.  **Report Generation**:
    -   Comprehensive document quality analysis
    -   Formatting suggestions
    -   Content recommendations
    -   ATS compatibility score

### Interview Practice Workflow

1.  **Session Creation**:
    -   Select application to practice for
    -   Choose interview type (behavioral, technical, company-specific, resume grill)
    -   Set difficulty level
    -   AI generates contextual questions

2.  **Practice Options**:
    -   **Text Mode**: Type your answers, get instant feedback
    -   **Voice Mode**: Record answers, automatic transcription
    -   **Live Conversation**: Real-time two-way AI conversation
    -   **Resume Grill**: AI challenges specific resume claims

3.  **Scoring System**:
    -   Overall score (0-10)
    -   Breakdown scores for:
        -   Clarity (how well you communicated)
        -   Structure (STAR method, logical flow)
        -   Relevance (answered the question)
        -   Depth (level of detail)
        -   Confidence (delivery quality)

4.  **Feedback & Reports**:
    -   Immediate feedback after each answer
    -   Strengths and weaknesses identified
    -   Actionable improvement suggestions
    -   Full session report with analytics

5.  **Progress Tracking**:
    -   Performance trends over time
    -   Category-specific improvements
    -   Common weaknesses patterns
    -   Interview readiness score

### Email System

ApplyOS includes a comprehensive email system:

-   **Queue-based delivery** - Emails queued in database, processed reliably
-   **SMTP Support** - Generic SMTP integration for any email service
-   **Retry mechanism** - Failed emails automatically retried
-   **Status tracking** - Monitor delivery status per email
-   **Templates**:
    -   Welcome email for new users
    -   Deadline reminders (7/3/1 days before)
    -   Weekly digest of application activity
    -   Status update notifications
-   **Premium Dark Theme** - Consistent, branded email templates with dark mode aesthetics (Neon Green on Dark Gray).

### Cron Jobs (Scheduled Tasks)

Configured for Vercel or any cron scheduler:

-   **Deadline Reminders** (`/api/cron/deadline-reminders`)
    -   Runs daily
    -   Sends reminders 7, 3, and 1 day before deadlines

-   **Weekly Digest** (`/api/cron/weekly-digest`)
    -   Runs weekly
    -   Summarizes application activity

-   **Notification Cleanup** (`/api/cron/cleanup-old-notifications`)
    -   Runs daily
    -   Removes old notifications

-   **AI Retry** (`/api/cron/retry-ai-tasks`)
    -   Runs every 30 minutes
    -   Retries rate-limited AI operations

All endpoints require `CRON_SECRET` header for security.

### Marketing Automation (Beta)

ApplyOS includes internal tools for marketing content generation:

-   **Content Calendar** - Database schema for planning LinkedIn and Twitter posts
-   **n8n Workflows** - Integrated automation workflows (json files in root) for:
    -   Auto-generating social media content using Gemini AI
    -   Publishing to platforms via API
    -   Image generation for posts

## Deployment

### Deploy to Vercel (Recommended)

1.  **Push to GitHub**

    ```bash
    git add .
    git commit -m "Ready for deployment"
    git push origin main
    ```

2.  **Import to Vercel**

    -   Go to [Vercel Dashboard](https://vercel.com/dashboard)
    -   Click "New Project"
    -   Import your GitHub repository
    -   Vercel will automatically detect Next.js

3.  **Add Environment Variables**

    In Vercel project settings, add all variables from your `.env.local`:
    -   `NEXT_PUBLIC_SUPABASE_URL`
    -   `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    -   `GEMINI_API_KEY`
    -   `SMTP_HOST`
    -   `SMTP_PORT`
    -   `SMTP_USER`
    -   `SMTP_PASS`
    -   `SMTP_SECURE`
    -   `SMTP_FROM_NAME`
    -   `SMTP_FROM_EMAIL`
    -   `ADMIN_EMAIL` (optional)
    -   `CRON_SECRET` (if using cron jobs)
    -   `SUPABASE_SERVICE_ROLE_KEY` (optional)
    -   `NEXT_PUBLIC_APP_URL` (your production URL)

4.  **Configure Cron Jobs** (optional)

    In `vercel.json`, cron jobs are pre-configured:
    -   Deadline reminders: Daily at 9 AM UTC
    -   Weekly digest: Sundays at 10 AM UTC
    -   Cleanup: Daily at 2 AM UTC
    -   AI retry: Every 30 minutes

5.  **Deploy**

    -   Click "Deploy"
    -   Vercel automatically deploys on every push to `main`
    -   Preview deployments created for all pull requests

### Production Checklist

-   [ ] All migrations applied to production Supabase
-   [ ] Storage bucket created and secured
-   [ ] Environment variables set in Vercel
-   [ ] Email SMTP credentials configured (if using emails)
-   [ ] Cron secret configured (if using scheduled tasks)
-   [ ] Production URL set in `NEXT_PUBLIC_APP_URL`
-   [ ] Test authentication flow
-   [ ] Test document upload and analysis
-   [ ] Test interview creation
-   [ ] Test email delivery (use `/api/email/test`)
-   [ ] Monitor Gemini API usage and costs

## Project Structure

```
ApplyOS/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── account/             # Account management (avatar, delete)
│   │   ├── applications/        # Application import/export
│   │   ├── auth/                # Auth endpoints (signup, verify-email)
│   │   ├── analytics/           # Analytics endpoints
│   │   ├── cover-letter/        # Cover letter generation
│   │   ├── cron/                # Scheduled tasks
│   │   ├── documents/           # Document operations
│   │   ├── email/               # Email sending
│   │   ├── feedback/            # User feedback
│   │   ├── interview/           # Interview practice endpoints
│   │   ├── notes/               # Application notes
│   │   ├── notifications/       # Notification system
│   │   └── questions/           # Question extraction
│   ├── (auth)/                  # Auth pages (login, signup, verify)
│   ├── applications/            # Application management UI
│   ├── dashboard/               # Main dashboard
│   ├── documents/               # Document management UI
│   ├── interview/               # Interview practice UI
│   ├── feedback/                # Feedback page
│   ├── notifications/           # Notifications page
│   ├── profile/                 # User profile
│   ├── settings/                # Settings page
│   ├── upload/                  # Document upload page
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Landing page
├── modules/                      # Feature Modules
│   ├── analytics/                # Analytics domain
│   ├── applications/             # Application lifecycle
│   ├── auth/                     # Authentication domain
│   ├── blog/                     # Blog content
│   ├── documents/                # Document processing
│   ├── interviews/               # Interview practice system
│   ├── marketing/                # Marketing tools
│   ├── notes/                    # Notes & rich text
│   └── notifications/            # Notification logic
├── components/
│   ├── analytics/               # Analytics charts (Sankey, Timeline, etc.)
│   ├── interview/               # Interview components
│   ├── layout/                  # Layout components (sidebar, topbar)
│   ├── modals/                  # Modal dialogs
│   ├── notes/                   # Notes components
│   └── ui/                      # shadcn/ui components
├── lib/
│   ├── ai/                      # AI utilities (retry, model manager)
│   ├── audio/                   # Audio recording utilities
│   ├── email/                   # Email service and templates
│   ├── gemini-live/             # Live conversation support
│   ├── middleware/              # Rate limiting middleware
│   ├── services/                # Business logic layer
│   ├── supabase/                # Supabase clients (browser/server)
│   ├── ai.ts                    # Gemini AI integration
│   ├── ai-audio.ts              # Audio transcription
│   ├── csv-utils.ts             # CSV import/export
│   ├── docx-utils.ts            # DOCX parsing
│   ├── password-security.ts     # Password leak detection
│   ├── pdf-utils.ts             # PDF text extraction
│   └── utils.ts                 # Utility functions
├── supabase/
│   ├── functions/               # Supabase Edge Functions
│   │   └── analyze-screenshot/  # AI screenshot analysis logic
│   └── migrations/              # SQL migration files (001-021)
├── types/
│   └── database.ts              # TypeScript type definitions
├── contexts/
│   └── AuthContext.tsx          # Authentication context
├── middleware.ts                # Route protection middleware
├── next.config.js               # Next.js configuration
├── tailwind.config.ts           # Tailwind configuration
├── tsconfig.json                # TypeScript configuration
├── vercel.json                  # Vercel deployment config
├── Call_Gemini_Image_Generation_API.json # n8n workflow for images
├── applyos-weekday-auto-publisher.json   # n8n workflow for social publishing
└── applyos_social_media_manager.json     # n8n workflow for content curation
```

## API Endpoints

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/signup` | POST | Create user account with email/password |
| `/api/auth/verify-email` | GET | Verify email with token from email link |
| `/api/auth/resend-verification` | POST | Resend verification email (rate-limited) |
| `/auth/callback` | GET | OAuth callback handler (Google) |

### Documents

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documents/upload` | POST | Upload and analyze documents |
| `/api/documents/reprocess` | POST | Re-analyze existing document |
| `/api/documents/[id]` | GET/DELETE | Get or delete document |
| `/api/documents/[id]/summary` | POST | Generate document summary |
| `/api/documents/[id]/report` | POST | Generate comprehensive document report |

### Applications

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/applications/import/template` | GET | Download CSV import template |
| `/api/applications/import/validate` | POST | Validate CSV before import |
| `/api/applications/import/execute` | POST | Execute validated CSV import |

### Interview Practice

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/interview/generate-questions` | POST | Generate interview questions for session |
| `/api/interview/submit-answer` | POST | Submit and score answer (deprecated) |
| `/api/interview/save-answer-v2` | POST | Submit and score answer (new) |
| `/api/interview/reset` | POST | Reset interview session |
| `/api/interview/report/generate` | POST | Generate interview report |
| `/api/interview/grill-resume` | POST | Start resume grilling session |
| `/api/interview/company-prep` | POST | Company-specific preparation |
| `/api/interview/conversation` | POST | Real-time conversation endpoint |
| `/api/interview/voice/transcribe` | POST | Transcribe voice answer |
| `/api/interview/live-session/init` | POST | Initialize live interview |
| `/api/interview/live-session/complete` | POST | Complete live interview |
| `/api/interview/live-session/flush` | POST | Flush conversation state |

### Cover Letters

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cover-letter/generate` | POST | Generate AI cover letter |

### Questions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/questions/extract-from-url` | POST | Extract questions from application URL |
| `/api/questions/regenerate` | POST | Regenerate answers for questions |

### Analytics

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analytics/metrics` | GET | Get application metrics |
| `/api/analytics/status-flow` | GET | Get status transition data |

### Account & Profile

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/account/delete` | DELETE | Delete user account and all data |
| `/api/account/avatar` | POST | Upload and update user avatar |

### Notes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notes` | GET/POST | List or create notes |
| `/api/notes/[id]` | GET/PUT/DELETE | Get, update, or delete note |

### Notifications

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notifications/send-status-email` | POST | Send status update notification |

### Email

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/email/welcome` | POST | Send welcome email to new user |
| `/api/email/test` | POST | Test email delivery |

### Feedback

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/feedback` | GET/POST | List or submit feedback |

### Cron Jobs (Protected with CRON_SECRET)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cron/deadline-reminders` | POST | Daily deadline reminder emails |
| `/api/cron/weekly-digest` | POST | Weekly application digest |
| `/api/cron/cleanup-old-notifications` | POST | Clean up old notifications |
| `/api/cron/retry-ai-tasks` | POST | Retry rate-limited AI tasks |

## Contributing

We welcome contributions! Here's how you can help:

### Areas for Contribution

- Testing infrastructure and test coverage
- LinkedIn integration for job imports
- Calendar integration (Google Calendar, Outlook)
- Browser extension for quick application saves
- Mobile app (React Native)
- AI model improvements
- Performance optimizations
- Internationalization (i18n)
- UI/UX enhancements
- Documentation improvements

### Contribution Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Follow code standards (TypeScript, ESLint config)
5. Test your changes locally
6. Commit with clear messages (`git commit -m 'feat: add amazing feature'`)
7. Push to your branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Code Standards

- Follow TypeScript best practices
- Use ESLint configuration provided
- Write clear, descriptive commit messages (Conventional Commits)
- Add comments for complex logic
- Test locally before submitting (`npm run build`)
- Ensure no TypeScript errors
- Follow existing file/folder structure

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

**Live:** [applyos.io](https://applyos.io/)

**Built with:** Next.js 16 • React 19 • TypeScript • Supabase • Google Gemini 2.0 Flash • Tailwind CSS • shadcn/ui

**Questions?** Open an issue or check out the documentation.
