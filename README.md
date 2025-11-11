# Trackly - Application & Document Manager


<div align="center">
  <img src="https://img.shields.io/badge/Next.js-16.0.1-black" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.4.0-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-Enabled-green" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tailwind-3.4.3-38bdf8" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel" alt="Vercel" />
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License" />
</div>

<br />

> Intelligent Application & Document Manager with AI-Powered Analysis

Trackly is a full-stack web application that helps you manage job and scholarship applications with powerful AI-powered document analysis. Track applications, analyze resumes with AI, generate smart summaries, and organize your entire career journey in one place.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Document Processing](#document-processing)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Contributing](#contributing)
- [License](#license)

## Features

### AI-Powered Document Analysis

- **Automatic Text Extraction** - Intelligent parsing of PDF and text files on upload
- **Structured Data Extraction** - AI extracts education, work experience, skills, achievements, and certifications
- **Smart Summaries** - Concise AI-generated summaries of document content
- **Cached Processing** - Text extracted once and cached for instant future operations
- **Real-time Status Tracking** - Monitor analysis progress (not_analyzed, pending, success, failed)
- **On-Demand Regeneration** - Re-analyze documents and regenerate summaries anytime

### Application Management

- **Complete Lifecycle Tracking** - Manage applications from draft to final decision
- **Status Workflow** - Track progress through draft → submitted → in_review → interview → offer/rejected
- **Priority Management** - Categorize applications as low, medium, or high priority
- **Deadline Monitoring** - Set and track application deadlines with visual alerts
- **URL Storage** - Save links to job postings and application portals
- **Notes & Details** - Add custom notes and details for each application
- **Status History** - Automatic tracking of all status changes with timestamps
- **Linked Documents** - Associate documents (resumes, cover letters) with specific applications

### Dashboard & Analytics

- **Application Statistics** - Total applications, pending decisions, and deadline counts
- **Document Overview** - Track uploaded documents and analysis status
- **Recent Activity** - Quick access to recently updated applications
- **Status Distribution** - Visual breakdown of application statuses
- **Upcoming Deadlines** - Alerts for approaching deadlines

### Document Management

- **Multi-file Upload** - Upload multiple PDFs and text files simultaneously
- **Detailed Analysis View** - View complete AI extraction results
- **Summary Generation** - AI-powered document summaries
- **File Storage** - Secure cloud storage for all documents
- **Version Tracking** - Track document versions and updates
- **Download Support** - Download original files anytime

### Authentication & Security

- **Secure Authentication** - Email/password authentication via Supabase
- **Email Verification** - Required email verification for all signup methods
- **OAuth Google Integration** - Seamless Google OAuth with email verification flow
- **Smart OAuth Verification** -
  - New signups: Email verification required before access
  - Returning unverified users: Auto-resend verification email
  - Unregistered login attempts: Clear error message
  - Cross-provider linking: Auto-link Google to verified email accounts
- **Protected Routes** - Automatic middleware-based route protection
- **Row-Level Security** - Database-level access control for all user data
- **Automatic User Profiles** - Profile creation on first signup
- **Rate-Limited Verification** - 5-minute rate limit on verification email resends
- **Secure File Storage** - Cloud-based document storage with access control

### User Interface

- **Responsive Design** - Optimized for desktop, tablet, and mobile devices
- **Modern UI Components** - Clean interface built with shadcn/ui
- **Smooth Animations** - Framer Motion-powered transitions
- **Toast Notifications** - Real-time feedback for user actions
- **Dark Mode Support** - Automatic theme adaptation
- **Intuitive Navigation** - Easy-to-use sidebar and navigation system
- **Email Verification Pages** - Beautiful verification check and success pages

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 18+** and npm
- **Git** for version control
- **Supabase Account** - [Sign up here](https://supabase.com)
- **Google AI API Key** (optional, for AI features) - [Get it here](https://makersuite.google.com/app/apikey)

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/NajibOladosu/Trackly.git
   cd Trackly
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

   This will install all required packages including Next.js, React, Supabase client, and AI dependencies.

## Configuration

1. **Create environment file**

   Create a `.env.local` file in the root directory:

   ```env
   # Supabase Configuration (Required)
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

   # AI Configuration (Optional - Required for document analysis)
   GEMINI_API_KEY=your-google-gemini-api-key

   # Cron Jobs (Optional - For scheduled emails)
   CRON_SECRET=your-secret-key-for-cron-jobs

   # Backend Configuration (Optional - For advanced features)
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. **Get Supabase credentials**

   - Go to your [Supabase Dashboard](https://supabase.com/dashboard)
   - Select your project or create a new one
   - Navigate to Settings > API
   - Copy the `URL` and `anon/public` key

3. **Get Google Gemini API key** (optional but recommended)

   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy and add to `.env.local`

4. **Set up Gmail SMTP** (optional - for email notifications)

   To enable email notifications:
   - Enable 2-Factor Authentication on your Gmail account
   - Generate an App Password for Trackly
   - Add `GMAIL_USER` and `GMAIL_APP_PASSWORD` to `.env.local`

   **For detailed instructions, see [EMAIL_SETUP.md](./EMAIL_SETUP.md)**

## Database Setup

### Step 1: Apply Migrations

In your Supabase project's SQL Editor, run the following migrations in order:

**Migration 1: Core Schema**
```sql
-- Run the contents of: supabase/migrations/001_initial_schema.sql
```

This creates:
- Users table with automatic profile creation
- Applications table with status tracking
- Questions table for application questions
- Notifications system
- Status history for audit trail
- All necessary triggers and RLS policies

**Migration 2: Document Analysis Fields**
```sql
-- Run the contents of: supabase/migrations/002_add_document_analysis_fields.sql
```

This adds:
- Document analysis status tracking
- AI-generated summary storage
- Error logging for failed analyses
- Timestamps for all operations

**Migration 3: Text Extraction Optimization**
```sql
-- Run the contents of: supabase/migrations/003_add_extracted_text_column.sql
```

This adds:
- Extracted text caching for performance
- Full-text search capabilities
- Optimized indexes

**Migration 4: Email Tracking** (Optional - only if using email features)
```sql
-- Run the contents of: supabase/migrations/004_add_email_tracking.sql
```

This adds:
- Email sending status tracking in notifications
- Email queue table for reliable delivery
- Email retry mechanism
- Email error logging

**Migration 5: Email Verification** (Required for OAuth flows)
```sql
-- Run the contents of: supabase/migrations/006_add_email_verification.sql
```

This adds:
- Email verification tracking for all users
- Verification token management with 24-hour expiration
- Rate limiting timestamps for verification emails
- OAuth auto-verification support

### Step 2: Create Storage Bucket

1. In your Supabase Dashboard, go to **Storage**
2. Click **Create a new bucket**
3. Name it `documents`
4. Set the bucket to **Public** (or configure RLS policies for private access)
5. Save the bucket

### Step 3: Configure Storage Policies (Optional)

For enhanced security, you can set up Row Level Security policies on the storage bucket to ensure users can only access their own documents.

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

## Document Processing

### How It Works

Trackly uses a sophisticated document processing pipeline:

#### Upload Flow

1. **File Upload** - User uploads PDF or text document
2. **Text Extraction** - Content is parsed using pdf-parse library
3. **Cloud Storage** - File stored securely in Supabase Storage
4. **Database Entry** - Metadata and extracted text saved to database
5. **AI Analysis** - Google Gemini extracts structured data (education, skills, experience)
6. **Status Update** - Analysis marked as complete or failed

#### Analysis Flow

1. **Cached Text** - System checks for previously extracted text
2. **Fast Processing** - Uses cached text if available (instant!)
3. **Re-extraction** - Fetches and extracts text only if needed
4. **AI Processing** - Gemini analyzes content and extracts structured data
5. **Data Storage** - Results saved to database

#### Summary Generation

1. **Text Retrieval** - Uses cached extracted text
2. **AI Summary** - Gemini generates concise summary
3. **Storage** - Summary cached in database
4. **On-Demand Regeneration** - Can be regenerated anytime with force flag

### Performance Benefits

- ⚡ **One-time extraction** - Text extracted once during upload
- 🚀 **Instant reuse** - Cached text used for all subsequent operations
- 💨 **Fast analysis** - No repeated file fetching or parsing
- 📊 **Efficient** - Reduced API calls and processing time

### Supported File Types

- ✅ PDF documents (.pdf)
- ✅ Text files (.txt)
- ✅ JSON files (.json)
- ❌ Word documents (.doc, .docx) - Coming soon

## Deployment

### ✅ Live on Vercel

This project is deployed on **Vercel** with automatic deployments enabled. Every push to the `main` branch triggers an automatic build and deployment.

**Live URL:** Your deployment will be available at `https://your-project.vercel.app` after setup.

### Deploy to Vercel (Recommended)

1. **Push to GitHub**

   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Import to Vercel**

   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will automatically detect it's a Next.js project

3. **Add Environment Variables**

   In Vercel project settings, add all variables from your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (optional)

4. **Enable Automatic Deployments**

   - Vercel automatically deploys on every push to `main`
   - Preview deployments are created for all pull requests
   - Deployments are available within minutes

5. **Configure Production Database**

   - Apply all migrations to your production Supabase instance
   - Create the `documents` storage bucket
   - Configure storage policies

### Vercel Configuration

The project includes a `vercel.json` configuration file that defines:
- Build command: `npm run build`
- Development command: `npm run dev`
- Framework: Next.js
- Required environment variables

No additional configuration is needed—just push to main!

### Environment Variables for Production

```env
NEXT_PUBLIC_SUPABASE_URL=your-production-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
GEMINI_API_KEY=your-gemini-api-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Project Structure

```
Trackly/
├── app/                      # Next.js App Router
│   ├── api/                  # API routes
│   │   ├── account/         # Account management endpoints
│   │   └── documents/       # Document operations
│   ├── (auth)/              # Authentication pages
│   ├── (dashboard)/         # Protected dashboard pages
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Landing page
├── components/
│   ├── layout/              # Layout components
│   ├── modals/              # Modal dialogs
│   └── ui/                  # shadcn/ui components
├── lib/
│   ├── supabase/            # Supabase client setup
│   ├── services/            # Database service layer
│   ├── ai.ts                # AI integration
│   └── utils.ts             # Utility functions
├── supabase/
│   └── migrations/          # SQL migration files
├── types/
│   └── database.ts          # TypeScript type definitions
├── middleware.ts            # Authentication middleware
├── next.config.js           # Next.js configuration
├── tailwind.config.ts       # Tailwind configuration
└── tsconfig.json            # TypeScript configuration
```

## API Endpoints

### Document Operations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documents/upload` | POST | Upload and analyze documents |
| `/api/documents/reprocess` | POST | Re-analyze existing document |
| `/api/documents/[id]` | GET | Get document details |
| `/api/documents/[id]/summary` | POST | Generate document summary |

### Account Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/account/delete` | POST | Delete user account and data |

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/signup` | POST | Create user account with email/password |
| `/api/auth/verify-email` | GET | Verify email with token from email link |
| `/api/auth/resend-verification` | POST | Resend verification email |
| `/auth/callback` | GET | OAuth callback handler (Google, GitHub) |

Authentication is handled by Supabase Auth with automatic middleware protection on all dashboard routes.

#### OAuth Flow

The application supports Google OAuth with automatic email verification:
- **New Users**: Sign up with Google → verify email → access granted
- **Existing Verified Users**: Sign in with Google → instant access
- **Returning Unverified Users**: Sign in with Google → verification email sent
- **Unregistered Users**: Sign in with Google → error message "User not registered"

## Contributing

We welcome contributions! Here's how you can help:

### Areas for Contribution

- 🧪 Testing infrastructure and test coverage
- 📄 Support for Word documents (.docx)
- 🔔 Real-time notifications with WebSockets
- 📱 Mobile app development
- 🔒 Enhanced security features
- ⚡ Performance optimizations
- 🌐 Internationalization (i18n)
- 🎨 UI/UX improvements

### Contribution Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit with clear messages (`git commit -m 'Add amazing feature'`)
5. Push to your branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Code Standards

- Follow TypeScript best practices
- Use ESLint configuration provided
- Write clear, descriptive commit messages
- Add comments for complex logic
- Test your changes locally before submitting

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

**[Trackly](https://trackly-chi.vercel.app/)** - Manage your career journey with AI-powered intelligence