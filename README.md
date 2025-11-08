# Trackly - Application & Document Manager

Trackly is a full-stack Next.js application for managing job and scholarship applications, documents, and related activity in a single dashboard. It integrates with Supabase for authentication, database, and storage, and provides APIs for document upload and (re)processing that can be extended with AI.

This README reflects the actual implementation in this repository and intentionally avoids claiming features that are not fully wired yet.

## ✨ Current Capabilities

### Authentication & Access Control

- Email/OAuth authentication via Supabase Auth.
- Protected routes enforced via middleware.
- Server and client Supabase clients configured for use across the app.

Key locations:
- [`app/auth/login/page.tsx`](app/auth/login/page.tsx:1)
- [`app/auth/signup/page.tsx`](app/auth/signup/page.tsx:1)
- [`app/auth/callback/route.ts`](app/auth/callback/route.ts:1)
- [`lib/supabase/client.ts`](lib/supabase/client.ts:1)
- [`lib/supabase/server.ts`](lib/supabase/server.ts:1)
- [`middleware.ts`](middleware.ts:1)

### Dashboard & Core Pages

Screens implemented with a consistent layout and navigation:

- Landing page
- Auth pages (login/signup)
- Dashboard
- Applications list and detail
- Documents list
- Upload page
- Notifications
- Profile
- Settings

Key locations:
- [`app/page.tsx`](app/page.tsx:1)
- [`app/layout.tsx`](app/layout.tsx:1)
- [`app/dashboard/page.tsx`](app/dashboard/page.tsx:1)
- [`app/applications/page.tsx`](app/applications/page.tsx:1)
- [`app/applications/[id]/page.tsx`](app/applications/[id]/page.tsx:1)
- [`app/documents/page.tsx`](app/documents/page.tsx:1)
- [`app/upload/page.tsx`](app/upload/page.tsx:1)
- [`app/notifications/page.tsx`](app/notifications/page.tsx:1)
- [`app/profile/page.tsx`](app/profile/page.tsx:1)
- [`app/settings/page.tsx`](app/settings/page.tsx:1)
- Layout & navigation components under [`components/layout/`](components/layout/dashboard-layout.tsx:1)

### Applications & Questions

The schema and service layer support tracking applications and related questions.

- `applications` table for storing application records.
- `questions` table for storing questions associated with applications.
- Service helpers for reading/writing these entities.

Key locations:
- [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql:1)
- [`lib/services/applications.ts`](lib/services/applications.ts:1)
- [`lib/services/questions.ts`](lib/services/questions.ts:1)

Note: Advanced AI-powered question extraction and answer generation are supported at the schema/service level via [`lib/ai.ts`](lib/ai.ts:1) but are not fully production-hardened. Treat them as an integration point, not a finalized feature.

### Document Management

Implemented:

- Uploading documents associated with a user/application to a Supabase Storage bucket.
- Persisting document metadata in the database.
- Reprocessing endpoint to re-parse existing documents (e.g. after improving parsing logic).

Key locations:
- [`app/api/documents/upload/route.ts`](app/api/documents/upload/route.ts:1)
- [`app/api/documents/reprocess/route.ts`](app/api/documents/reprocess/route.ts:1)
- [`lib/services/documents.ts`](lib/services/documents.ts:1)
- `documents` tables and relations in [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql:1)

Important notes:

- Upload and reprocess routes include authentication checks and use RLS-protected tables.
- DOC/DOCX and some complex formats are not fully supported yet.
- No built-in antivirus scanning or rate limiting—these should be added before real production use.

### Notifications

Implemented:

- `notifications` table with RLS.
- Backend helpers for creating and fetching notifications.
- Notifications page and basic UI wiring.

Key locations:
- [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql:1)
- [`lib/services/notifications.ts`](lib/services/notifications.ts:1)
- [`app/notifications/page.tsx`](app/notifications/page.tsx:1)

Not yet implemented:

- Email delivery
- Real-time subscriptions
- Granular notification preferences

### Account Deletion

Implemented:

- Authenticated API route to delete the current user’s account and associated data (subject to schema constraints).

Key location:
- [`app/api/account/delete/route.ts`](app/api/account/delete/route.ts:1)

Recommended:

- Ensure UI flows (e.g. profile/settings) call this endpoint with clear confirmation.

### UI/UX

- Built with Next.js App Router and TypeScript.
- Tailwind CSS and shadcn/ui-based components.
- Responsive layout for desktop and mobile.
- Centralized layout components for dashboard shell (sidebar, topbar).

Key locations:
- [`app/globals.css`](app/globals.css:1)
- [`components/ui`](components/ui/button.tsx:1)
- [`components/layout`](components/layout/dashboard-layout.tsx:1)
- [`components/modals`](components/modals/add-application-modal.tsx:1)

## 🏗 Tech Stack

- Framework: Next.js 14 (App Router)
- Language: TypeScript
- Styling: Tailwind CSS
- Components: shadcn/ui
- Backend: Supabase (PostgreSQL, Auth, Storage)
- Database migrations: SQL under [`supabase/migrations`](supabase/migrations/001_initial_schema.sql:1)

## 📊 Database Overview

Primary tables (see migration for full definitions):

- `users` – profile data linked to `auth.users`
- `applications` – job/scholarship application records
- `questions` – questions per application (and potential AI-generated answers)
- `documents` – uploaded documents with metadata
- `notifications` – in-app notifications
- `status_history` – change history for applications

All core tables in [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql:1) have Row Level Security enabled with policies that scope access to the authenticated user.

## ⚙️ Environment Configuration

Create a `.env.local` file in the project root with at least:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Optional: Required if you enable AI parsing/features
GEMINI_API_KEY=your_gemini_api_key_here
```

Recommended additional variables for a production-grade deployment (not all are currently wired end-to-end, but should be considered):

```env
NEXT_PUBLIC_APP_URL=https://your-production-url

# For secure backend jobs (never expose to browser)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Operational controls
LOG_LEVEL=info
ERROR_TRACKING_DSN=your_sentry_or_other_dsn
STORAGE_DOCUMENTS_BUCKET=documents
MAX_UPLOAD_SIZE_MB=10
MAX_FILES_PER_UPLOAD=5
ALLOWED_UPLOAD_MIME_TYPES=application/pdf,text/plain
AI_REQUEST_MAX_TOKENS=8000
AI_REQUEST_TIMEOUT_MS=30000
```

Ensure that any secrets (e.g. `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`) are configured only as server-side environment variables in your hosting provider.

## 🧪 Status of AI & Advanced Features

The codebase includes integration points for AI functionality via [`lib/ai.ts`](lib/ai.ts:1) and related services. Before treating AI behaviors as production-ready, you should:

- Validate prompt design and outputs.
- Add rate limiting and abuse protection.
- Add robust error handling and logging.
- Ensure costs and usage are monitored.

Similarly, features such as:

- Automatic deadline reminders
- Real-time notification streaming
- Full document version history UI
- Rich notification preferences
- External email notifications

are partially supported by the schema or structure, but require additional work before being advertised as complete production features.

## 🛠 Local Development

1. Clone the repository:

   ```bash
   git clone https://github.com/NajibOladosu/Trackly.git
   cd Trackly
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure environment variables:

   - Create `.env.local` as described above.

4. Set up the database:

   - In your Supabase project, open the SQL editor.
   - Apply the SQL from:
     - [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql:1)

5. Run the development server:

   ```bash
   npm run dev
   ```

   Then open `http://localhost:3000` in your browser.

## 🚀 Deployment Notes

For deployment (e.g. Vercel):

- Set all required environment variables in the hosting platform.
- Ensure your Supabase project has:
  - The schema from [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql:1)
  - A `documents` storage bucket with appropriate policies (public or private + signed URLs).
- Confirm Next.js runtime settings for routes that rely on Node-only modules (e.g. document parsing).

This repository should be treated as a strong foundation that requires the hardening steps described in the architecture/roadmap before true production exposure.

## 🤝 Contributing

Contributions that move Trackly toward full production readiness are welcome, especially:

- Improved validation and error handling
- Upload and AI safety controls
- Notification channels and preferences
- Observability and testing

Standard flow:

1. Fork the repository.
2. Create a feature branch.
3. Commit and push your changes.
4. Open a Pull Request.

## 📝 License

This project is licensed under the MIT License. See `LICENSE` for details.