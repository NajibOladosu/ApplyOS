# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Trackly is a full-stack Next.js application for managing job and scholarship applications, documents, and related activity. It uses Supabase for authentication, database (PostgreSQL with RLS), and storage.

**Tech Stack:**
- Next.js 14+ (App Router, TypeScript)
- Supabase (PostgreSQL, Auth, Storage)
- Tailwind CSS + shadcn/ui
- Google Gemini AI (optional, for document parsing and question answering)

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Production build
npm run lint         # Run ESLint
```

**Note:** There are currently no test commands configured. Tests should be added before production deployment.

## Architecture

### Next.js App Router Structure

The app follows Next.js 14+ App Router conventions:

- **`app/`** - All pages and API routes
  - **`app/api/`** - Backend API routes (documents upload/reprocess, account deletion)
  - **`app/(auth)/`** - Authentication pages (login, signup, callback)
  - **`app/(dashboard)/`** - Protected dashboard pages (applications, documents, upload, etc.)
- **`lib/`** - Shared utilities and services
  - **`lib/supabase/`** - Supabase client factories (server.ts for SSR, client.ts for CSR)
  - **`lib/services/`** - Data access layer (applications, documents, notifications, questions)
  - **`lib/ai.ts`** - Google Gemini AI integration (document parsing, question extraction, answer generation)
- **`components/`** - Reusable React components
  - **`components/ui/`** - shadcn/ui components
  - **`components/layout/`** - Layout components (dashboard shell, sidebar, topbar)
  - **`components/modals/`** - Modal dialogs
- **`types/`** - TypeScript type definitions (database types, application types)
- **`supabase/migrations/`** - Database schema migrations

### Authentication Flow

Authentication is handled via `middleware.ts`:

1. Creates a Supabase server client for each request
2. Checks user authentication status
3. Protected routes: `/dashboard`, `/applications`, `/documents`, `/upload`, `/notifications`, `/profile`, `/settings`
4. Redirects unauthenticated users to `/auth/login`
5. Redirects authenticated users away from auth pages to `/dashboard`

**Important:** Always use the correct Supabase client:
- Server Components/API Routes: `createClient()` from `lib/supabase/server.ts`
- Client Components: `createClient()` from `lib/supabase/client.ts`

### Database Schema & RLS

All tables are defined in `supabase/migrations/001_initial_schema.sql` with Row Level Security (RLS) enabled:

**Core Tables:**
- `users` - Profile data linked to `auth.users` (auto-created via trigger)
- `applications` - Job/scholarship applications (status: draft → submitted → in_review → interview → offer/rejected)
- `questions` - Questions associated with applications (supports AI-generated and manual answers)
- `documents` - Uploaded files with metadata (file_url, parsed_data JSONB, version)
- `notifications` - In-app notifications (types: info, success, warning, error, deadline, status_update)
- `status_history` - Audit trail for application status changes

**Key Database Features:**
- All tables have RLS policies scoping access to authenticated user (`auth.uid()`)
- `handle_new_user()` trigger automatically creates user profile on signup
- `track_status_change()` trigger logs status changes and creates notifications
- `handle_updated_at()` trigger maintains `updated_at` timestamps

### Service Layer Pattern

All database operations go through service files in `lib/services/`:

```typescript
// Example: lib/services/applications.ts
import { createClient } from "@/lib/supabase/client"

export async function getApplications() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw error
  return data
}
```

**Pattern:** Services use the client-side Supabase client. API routes use server-side client for enhanced security.

### Document Upload & Processing Pipeline

Document handling follows a specific flow (see `app/api/documents/upload/route.ts`):

1. **Upload:** Files are uploaded to Supabase Storage bucket `documents` under path `{user_id}/{timestamp}_{filename}`
2. **Metadata:** Document record inserted into `documents` table with file metadata
3. **AI Parsing:** If `GEMINI_API_KEY` is configured, `parseDocument()` extracts structured data (education, experience, skills, etc.)
4. **Storage:** Parsed data stored as JSONB in `parsed_data` column

**Important Notes:**
- Upload route uses `runtime = "nodejs"` for file handling
- Parsing is best-effort; errors don't fail the upload
- DOC/DOCX parsing is limited (PDF works better)
- No rate limiting or antivirus scanning currently implemented

**Reprocessing:** The `/api/documents/reprocess` endpoint allows re-parsing existing documents after improving parsing logic.

### AI Integration Points

AI features are powered by Google Gemini (model: `gemini-2.0-flash`) in `lib/ai.ts`:

- **`parseDocument(fileContent)`** - Extracts structured data from resumes/documents (returns typed `ParsedDocument` object)
- **`extractQuestionsFromURL(url)`** - Extracts application questions from job posting URLs
- **`generateAnswer(question, context)`** - Generates AI answers to application questions based on resume context
- **`summarizeDocument({ fileName, parsedData })`** - Creates concise document summaries

**Important:**
- All AI functions gracefully degrade if `GEMINI_API_KEY` is not set (return empty/fallback data)
- AI features are integration points, not production-hardened (add rate limiting, validation, monitoring before production use)

## Environment Variables

Required in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Optional (for AI features):

```env
GEMINI_API_KEY=your_gemini_api_key
```

Backend operations (when needed):

```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # Never expose to browser
```

## Database Setup

Before running the app, apply the schema migration:

1. Open your Supabase project SQL editor
2. Run the SQL from `supabase/migrations/001_initial_schema.sql`
3. Create a Storage bucket named `documents` with appropriate policies

## Key Architectural Decisions

1. **No tests currently exist** - Add tests before production deployment
2. **RLS enforces all access control** - Always trust RLS policies, but verify auth in API routes
3. **Service layer uses client-side Supabase client** - API routes use server-side client for sensitive operations
4. **AI parsing is best-effort** - Never fail user operations due to AI errors
5. **Documents use public URLs** - Consider switching to signed URLs for sensitive documents
6. **Notifications are in-app only** - Email delivery and real-time subscriptions not yet implemented

## Common Development Patterns

**Creating a new API route with auth:**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  // Your logic here
}
```

**Using service layer in a Server Component:**

```typescript
import { createClient } from "@/lib/supabase/server"

export default async function Page() {
  const supabase = await createClient()
  const { data: applications } = await supabase
    .from("applications")
    .select("*")
    .order("created_at", { ascending: false })

  // Render with applications
}
```

**Important:** The codebase mixes service functions (which use client-side Supabase) with direct server-side Supabase usage. In Server Components and API routes, prefer direct Supabase calls for better security.

## Production Readiness Gaps

The README explicitly notes this is a strong foundation requiring hardening:

- No rate limiting on uploads or AI endpoints
- No antivirus scanning for uploaded files
- No comprehensive error tracking/monitoring
- Limited document format support (DOC/DOCX)
- No email notifications
- No real-time subscriptions
- No test coverage
- AI features need validation and cost monitoring
