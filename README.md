# Trackly - AI-Powered Application Manager

<div align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.4-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-Enabled-green" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tailwind-3.4-38bdf8" alt="Tailwind" />
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License" />
</div>

<br />

Trackly is a production-ready, full-stack web application that automates the way you apply for jobs and scholarships. Built with a stunning Leadverse-inspired dark theme, Trackly uses AI to extract questions from job postings, generate personalized answers, and track all your applications in one beautiful dashboard.

## ✨ Features

### 🤖 AI-Powered Intelligence
- **Question Extraction**: Automatically extract application questions from URLs
- **Smart Response Generation**: Generate personalized answers using AI and your documents
- **Document Analysis**: Upload resumes and transcripts for automatic data extraction

### 📊 Application Management
- **Comprehensive Tracking**: Manage all applications in one place
- **Status Management**: Track progress from draft to offer
- **Priority Levels**: Mark applications as high, medium, or low priority
- **Deadline Reminders**: Never miss an application deadline

### 📁 Document Management
- **Secure Storage**: Upload and manage documents with Supabase Storage
- **AI Analysis**: Automatic extraction of education, experience, and skills
- **Version History**: Keep track of document versions

### 🔔 Notifications
- **Real-time Updates**: Get notified of status changes and deadlines
- **Smart Alerts**: AI-powered insights and recommendations
- **Customizable**: Configure notification preferences

### 🎨 Beautiful UI/UX
- **Leadverse-Inspired Design**: Dark, elegant theme with neon green accents
- **Smooth Animations**: Framer Motion-powered transitions
- **Fully Responsive**: Works perfectly on desktop, tablet, and mobile
- **Accessible**: Built with accessibility in mind

## 🚀 Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Charts**: Recharts
- **File Upload**: React Dropzone

### Backend
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (Email + Google OAuth)
- **Storage**: Supabase Storage
- **Real-time**: Supabase Realtime
- **Row Level Security**: Enabled on all tables

### AI Integration
- **Provider**: Google Gemini API
- **Models**: Gemini Pro for question extraction and answer generation
- **Document Processing**: AI-powered data extraction

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- Node.js 18+ and npm
- A Supabase account
- (Optional) A Google Gemini API key for AI features

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/NajibOladosu/Trackly.git
   cd Trackly
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   The `.env.local` file is already configured with Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://hvmaerptxgeldviarcuj.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

   # Add your Google Gemini API key for AI features
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

   To get your Gemini API key:
   1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   2. Sign in with your Google account
   3. Click "Create API Key"
   4. Copy your API key and paste it in the `.env.local` file

4. **Set up the database**

   Apply the database migration to your Supabase instance:
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Copy the contents of `supabase/migrations/001_initial_schema.sql`
   - Run the migration

5. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
Trackly/
├── app/                          # Next.js app directory
│   ├── auth/                     # Authentication pages
│   │   ├── login/                # Login page
│   │   ├── signup/               # Signup page
│   │   └── callback/             # OAuth callback
│   ├── dashboard/                # Dashboard page
│   ├── applications/             # Applications list & detail
│   ├── documents/                # Documents management
│   ├── upload/                   # File upload page
│   ├── notifications/            # Notifications center
│   ├── profile/                  # User profile
│   ├── settings/                 # App settings
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   └── globals.css               # Global styles
├── components/                   # React components
│   ├── ui/                       # shadcn/ui components
│   └── layout/                   # Layout components
├── lib/                          # Utility functions
│   ├── supabase/                 # Supabase clients
│   ├── utils.ts                  # Helper functions
│   └── ai.ts                     # AI service functions
├── supabase/                     # Supabase configuration
│   └── migrations/               # Database migrations
├── public/                       # Static assets
└── ...config files
```

## 🎨 Color Palette

The app uses a Leadverse-inspired dark theme:

| Color | Hex | Usage |
|-------|-----|-------|
| Background | `#0A0A0A` | Main background |
| Surface | `#101010` | Cards, panels |
| Border | `#1A1A1A` | Borders, dividers |
| Primary | `#00FF88` | Accent, buttons, links |
| Text Primary | `#EDEDED` | Main text |
| Text Secondary | `#B5B5B5` | Muted text |

## 📊 Database Schema

The application uses the following main tables:

- **users**: User profiles (extends Supabase auth.users)
- **applications**: Job and scholarship applications
- **questions**: Application questions and AI-generated answers
- **documents**: Uploaded files with AI analysis
- **notifications**: User notifications
- **status_history**: Application status change tracking

All tables have Row Level Security (RLS) enabled for data protection.

## 🔒 Security Features

- **Row Level Security**: All database tables protected with RLS policies
- **Authentication**: Secure email and OAuth authentication
- **Data Encryption**: All data encrypted at rest and in transit
- **Environment Variables**: Sensitive data stored in environment variables
- **HTTPS Only**: Production deployment requires HTTPS

## 🚀 Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Import your repository in Vercel
3. Add environment variables from `.env.local`
4. Deploy!

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/NajibOladosu/Trackly)

### Other Platforms

You can also deploy to:
- Netlify
- Railway
- Render
- Any platform that supports Next.js

## 🎯 Key Features in Detail

### AI Question Extraction
1. User pastes a job posting URL
2. AI fetches and analyzes the page content
3. Questions are extracted and stored in the database
4. User can review and edit extracted questions

### AI Answer Generation
1. User's documents are analyzed and parsed
2. AI generates personalized answers based on:
   - Extracted resume data
   - Education history
   - Work experience
   - Skills and qualifications
3. Answers can be edited and saved

### Application Tracking
- **Draft**: Initial stage, can be edited
- **Submitted**: Application sent
- **In Review**: Under consideration
- **Interview**: Interview scheduled
- **Offer**: Offer received
- **Rejected**: Application declined

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Design inspiration from [Leadverse.ai](https://leadverse.ai)
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Backend powered by [Supabase](https://supabase.com)
- AI features powered by [Google Gemini](https://ai.google.dev)

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

<div align="center">
  Made with ❤️ using Next.js, Supabase, and AI
</div>