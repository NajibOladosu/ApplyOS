/**
 * PREVIEW HARNESS — dev-only, never active in production.
 *
 * Why this exists: the authenticated pages can only be judged by rendering
 * them, and this sandbox has no Supabase access and no browser session. This
 * module stands in for Supabase when NEXT_PUBLIC_PREVIEW=1, serving seeded
 * rows (varied statuses, priorities, dates, scores) so a screenshot shows what
 * a real, populated account looks like — not an empty state.
 *
 * It is intentionally dependency-free and loosely typed; it implements only
 * the chain shapes the app's services actually use.
 */

export const PREVIEW_ENABLED =
  process.env.NEXT_PUBLIC_PREVIEW === "1" && process.env.NODE_ENV !== "production"

const USER_ID = "preview-user-0000-0000-000000000001"

export const previewUser = {
  id: USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: "ada.okafor@example.com",
  email_confirmed_at: "2026-01-04T09:12:00.000Z",
  created_at: "2026-01-04T09:12:00.000Z",
  updated_at: "2026-09-17T14:02:00.000Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {
    name: "Ada Okafor",
    full_name: "Ada Okafor",
    avatar_url: null,
  },
  identities: [],
  factors: [],
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()

// ---------------------------------------------------------------- seed data
const applications = [
  {
    id: "app-001", user_id: USER_ID, title: "Senior Frontend Engineer", company: "Stripe",
    url: "https://stripe.com/jobs", status: "interview", priority: "high", type: "job",
    deadline: daysAhead(3), job_description: "Build payment surfaces used by millions. React, TypeScript, design systems.",
    ai_cover_letter: null, manual_cover_letter: null, last_analyzed_document_id: "doc-001",
    archived: false, created_at: daysAgo(21), updated_at: daysAgo(1),
  },
  {
    id: "app-002", user_id: USER_ID, title: "Product Engineer", company: "Linear",
    url: "https://linear.app/careers", status: "offer", priority: "high", type: "job",
    deadline: null, job_description: "Own features end to end in a small, fast team.",
    ai_cover_letter: null, manual_cover_letter: null, last_analyzed_document_id: "doc-001",
    archived: false, created_at: daysAgo(38), updated_at: daysAgo(2),
  },
  {
    id: "app-003", user_id: USER_ID, title: "Frontend Engineer II", company: "Vercel",
    url: "https://vercel.com/careers", status: "in_review", priority: "medium", type: "job",
    deadline: daysAhead(9), job_description: "Next.js dashboard and edge runtime tooling.",
    ai_cover_letter: null, manual_cover_letter: null, last_analyzed_document_id: null,
    archived: false, created_at: daysAgo(12), updated_at: daysAgo(4),
  },
  {
    id: "app-004", user_id: USER_ID, title: "Design Systems Engineer", company: "Figma",
    url: "https://figma.com/careers", status: "submitted", priority: "medium", type: "job",
    deadline: daysAhead(1), job_description: "Bridge design and engineering across the editor.",
    ai_cover_letter: null, manual_cover_letter: null, last_analyzed_document_id: null,
    archived: false, created_at: daysAgo(8), updated_at: daysAgo(8),
  },
  {
    id: "app-005", user_id: USER_ID, title: "MSc Computer Science", company: "ETH Zürich",
    url: "https://ethz.ch/admissions", status: "draft", priority: "low", type: "scholarship",
    deadline: daysAhead(26), job_description: "Research-focused master's with a thesis component.",
    ai_cover_letter: null, manual_cover_letter: null, last_analyzed_document_id: null,
    archived: false, created_at: daysAgo(5), updated_at: daysAgo(5),
  },
  {
    id: "app-006", user_id: USER_ID, title: "Backend Engineer Internship", company: "Monzo",
    url: "https://monzo.com/careers", status: "rejected", priority: "low", type: "internship",
    deadline: daysAgo(6), job_description: "Go services for banking infrastructure.",
    ai_cover_letter: null, manual_cover_letter: null, last_analyzed_document_id: null,
    archived: false, created_at: daysAgo(52), updated_at: daysAgo(19),
  },
  {
    id: "app-007", user_id: USER_ID, title: "Staff Engineer, Growth", company: "Duolingo",
    url: "https://duolingo.com/careers", status: "submitted", priority: "high", type: "job",
    deadline: daysAgo(2), job_description: "Experiment-driven growth engineering at scale.",
    ai_cover_letter: null, manual_cover_letter: null, last_analyzed_document_id: null,
    archived: false, created_at: daysAgo(16), updated_at: daysAgo(3),
  },
  {
    id: "app-008", user_id: USER_ID, title: "Senior React Developer", company: "Shopify",
    url: "https://shopify.com/careers", status: "in_review", priority: "medium", type: "job",
    deadline: null, job_description: "Merchant-facing commerce surfaces.",
    ai_cover_letter: null, manual_cover_letter: null, last_analyzed_document_id: null,
    archived: false, created_at: daysAgo(29), updated_at: daysAgo(11),
  },
]

const documents = [
  {
    id: "doc-001", user_id: USER_ID, file_name: "Ada_Okafor_CV_2026.pdf",
    file_url: "/preview/cv.pdf", file_type: "application/pdf", file_size: 284_112,
    // shape mirrors ParsedDocument in shared/infrastructure/ai.ts
    parsed_data: {
      education: [
        {
          institution: "University of Lagos", degree: "BSc", field: "Computer Science",
          start_date: "2016", end_date: "2020",
          description: "Graduated with honours; final year project on distributed caching.",
        },
      ],
      experience: [
        {
          company: "Paystack", role: "Senior Frontend Engineer",
          start_date: "2022", end_date: "Present",
          description: "Led the design system migration across 40+ screens; cut bundle size 38%.",
        },
        {
          company: "Andela", role: "Frontend Engineer",
          start_date: "2020", end_date: "2022",
          description: "Built internal tooling for talent matching used by 200+ staff.",
        },
      ],
      projects: [
        {
          name: "Atlas UI", description: "Open-source component library with 1.2k GitHub stars.",
          technologies: ["React", "TypeScript", "Radix UI"], start_date: "2023", end_date: "Present",
        },
      ],
      skills: {
        technical: ["React", "TypeScript", "Next.js", "Tailwind CSS", "Design Systems", "Testing", "Accessibility", "Node.js"],
        soft: ["Mentoring", "Technical writing", "Cross-functional collaboration"],
        other: ["Figma", "Playwright", "GitHub Actions"],
      },
      achievements: ["Spoke at React Summit Lagos 2024", "Reduced checkout bundle by 38%"],
      certifications: [{ name: "AWS Certified Developer", issuer: "Amazon", date: "2023" }],
    },
    version: 3, created_at: daysAgo(24), updated_at: daysAgo(2),
    report: {
      documentType: "Résumé — Senior Frontend Engineer",
      overallScore: 8.4,
      overallAssessment:
        "A strong senior résumé: every role leads with a measurable outcome and the tooling reads as current. It loses points for a missing headline and for spacing that pushes the best work past the first screen.",
      categories: [
        {
          name: "Impact", score: 9,
          strengths: ["Each role opens with a number, not a responsibility", "Scope grows across the three roles"],
          improvements: [],
        },
        {
          name: "Clarity", score: 8.5,
          strengths: ["Plain language, no filler verbs", "Sections labelled conventionally"],
          improvements: ["Two bullets in the Stripe role are 40+ words — split them"],
        },
        {
          name: "ATS keywords", score: 8,
          strengths: ["React, TypeScript and design systems all appear naturally"],
          improvements: ["Add GraphQL if you keep applying to platform teams", "Spell out 'CI/CD' once before using it"],
        },
        {
          name: "Structure", score: 7.5,
          strengths: ["Single column, parseable headings"],
          improvements: ["Move education below experience — you are eight years in"],
        },
        {
          name: "Formatting", score: 8,
          strengths: ["Consistent date format throughout"],
          improvements: ["Tighten the top margin so the first role is visible without scrolling"],
        },
      ],
    },
    report_generated_at: daysAgo(2), analysis_status: "success", analysis_error: null,
    parsed_at: daysAgo(24), application_id: "app-001", extracted_text: "Ada Okafor — Senior Frontend Engineer…",
    analysis_result: null,
  },
  {
    id: "doc-002", user_id: USER_ID, file_name: "Ada_Okafor_CoverLetter_Stripe.pdf",
    file_url: "/preview/cover-letter.pdf", file_type: "application/pdf", file_size: 96_430,
    parsed_data: null, version: 1, created_at: daysAgo(9), updated_at: daysAgo(9),
    report: null, report_generated_at: null, analysis_status: "pending", analysis_error: null,
    parsed_at: null, application_id: "app-001", extracted_text: null, analysis_result: null,
  },
  {
    id: "doc-003", user_id: USER_ID, file_name: "Ada_Okafor_Resume_Backend.pdf",
    file_url: "/preview/resume-backend.pdf", file_type: "application/pdf", file_size: 301_998,
    parsed_data: null, version: 2, created_at: daysAgo(15), updated_at: daysAgo(15),
    report: null, report_generated_at: null, analysis_status: "failed",
    analysis_error: "Could not extract text — the file appears to be a scanned image.",
    parsed_at: null, application_id: null, extracted_text: null, analysis_result: null,
  },
  {
    id: "doc-004", user_id: USER_ID, file_name: "Portfolio_Case_Studies.pdf",
    file_url: "/preview/portfolio.pdf", file_type: "application/pdf", file_size: 1_842_336,
    parsed_data: null, version: 1, created_at: daysAgo(31), updated_at: daysAgo(31),
    report: null, report_generated_at: null, analysis_status: "not_analyzed", analysis_error: null,
    parsed_at: null, application_id: null, extracted_text: null, analysis_result: null,
  },
]

const interviewSessions = [
  {
    id: "sess-001", application_id: "app-001", user_id: USER_ID, session_type: "company_specific",
    company_name: "Stripe", difficulty: "hard", status: "completed",
    started_at: daysAgo(3), completed_at: daysAgo(3), total_questions: 8, answered_questions: 8,
    average_score: 78, total_duration_seconds: 1_920, conversation_mode: false,
    full_transcript: null, conversation_started_at: null, conversation_ended_at: null,
    created_at: daysAgo(3), updated_at: daysAgo(3),
  },
  {
    id: "sess-002", application_id: "app-002", user_id: USER_ID, session_type: "behavioral",
    company_name: "Linear", difficulty: "medium", status: "completed",
    started_at: daysAgo(11), completed_at: daysAgo(11), total_questions: 6, answered_questions: 6,
    average_score: 85, total_duration_seconds: 1_380, conversation_mode: false,
    full_transcript: null, conversation_started_at: null, conversation_ended_at: null,
    created_at: daysAgo(11), updated_at: daysAgo(11),
  },
  {
    id: "sess-003", application_id: "app-003", user_id: USER_ID, session_type: "technical",
    company_name: "Vercel", difficulty: "hard", status: "completed",
    started_at: daysAgo(6), completed_at: daysAgo(6), total_questions: 10, answered_questions: 9,
    average_score: 64, total_duration_seconds: 2_640, conversation_mode: false,
    full_transcript: null, conversation_started_at: null, conversation_ended_at: null,
    created_at: daysAgo(6), updated_at: daysAgo(6),
  },
  {
    id: "sess-004", application_id: "app-001", user_id: USER_ID, session_type: "resume_grill",
    company_name: "Stripe", difficulty: "medium", status: "completed",
    started_at: daysAgo(18), completed_at: daysAgo(18), total_questions: 7, answered_questions: 7,
    average_score: 91, total_duration_seconds: 1_560, conversation_mode: true,
    full_transcript: null, conversation_started_at: null, conversation_ended_at: null,
    created_at: daysAgo(18), updated_at: daysAgo(18),
  },
  {
    id: "sess-005", application_id: "app-004", user_id: USER_ID, session_type: "mixed",
    company_name: "Figma", difficulty: "medium", status: "in_progress",
    started_at: daysAgo(0), completed_at: null, total_questions: 8, answered_questions: 3,
    average_score: null, total_duration_seconds: null, conversation_mode: false,
    full_transcript: null, conversation_started_at: null, conversation_ended_at: null,
    created_at: daysAgo(0), updated_at: daysAgo(0),
  },
]

const interviewQuestions = [
  { id: "q-001", session_id: "sess-001", user_id: USER_ID, question_text: "Walk me through how you'd design an idempotent payment retry flow.", question_category: "system_design", difficulty: "hard", ideal_answer_outline: null, evaluation_criteria: null, question_order: 1, estimated_duration_seconds: 300, created_at: daysAgo(3) },
  { id: "q-002", session_id: "sess-001", user_id: USER_ID, question_text: "How do you keep a large design system consistent as it grows?", question_category: "technical", difficulty: "medium", ideal_answer_outline: null, evaluation_criteria: null, question_order: 2, estimated_duration_seconds: 240, created_at: daysAgo(3) },
  { id: "q-003", session_id: "sess-001", user_id: USER_ID, question_text: "Tell me about a time you disagreed with a product decision.", question_category: "behavioral", difficulty: "medium", ideal_answer_outline: null, evaluation_criteria: null, question_order: 3, estimated_duration_seconds: 180, created_at: daysAgo(3) },
  { id: "q-004", session_id: "sess-001", user_id: USER_ID, question_text: "What would you improve about Stripe's checkout flow?", question_category: "company_fit", difficulty: "hard", ideal_answer_outline: null, evaluation_criteria: null, question_order: 4, estimated_duration_seconds: 240, created_at: daysAgo(3) },
]

const interviewAnswers = [
  { id: "a-001", question_id: "q-001", session_id: "sess-001", user_id: USER_ID, answer_text: "I'd start with an idempotency key stored atomically alongside the intent…", answer_type: "text", audio_url: null, audio_duration_seconds: null, transcription_confidence: null, score: 82, feedback: { summary: "Strong grasp of idempotency, light on failure modes.", strengths: ["Clear structure", "Concrete examples"], improvements: ["Cover partial-failure recovery"] }, clarity_score: 88, structure_score: 84, relevance_score: 86, depth_score: 70, confidence_score: 80, time_taken_seconds: 268, created_at: daysAgo(3) },
  { id: "a-002", question_id: "q-002", session_id: "sess-001", user_id: USER_ID, answer_text: "Tokens first, then codemods, then a visual regression gate…", answer_type: "text", audio_url: null, audio_duration_seconds: null, transcription_confidence: null, score: 88, feedback: { summary: "Excellent, grounded in real migration experience.", strengths: ["Specific tooling", "Measurable outcome"], improvements: ["Mention adoption metrics"] }, clarity_score: 90, structure_score: 86, relevance_score: 92, depth_score: 84, confidence_score: 88, time_taken_seconds: 214, created_at: daysAgo(3) },
  { id: "a-003", question_id: "q-003", session_id: "sess-001", user_id: USER_ID, answer_text: "We shipped a smaller scope first, then measured…", answer_type: "text", audio_url: null, audio_duration_seconds: null, transcription_confidence: null, score: 74, feedback: { summary: "Good outcome, rambling setup.", strengths: ["Data-driven resolution"], improvements: ["Tighten the setup", "State the stake earlier"] }, clarity_score: 68, structure_score: 72, relevance_score: 80, depth_score: 76, confidence_score: 74, time_taken_seconds: 195, created_at: daysAgo(3) },
  { id: "a-004", question_id: "q-004", session_id: "sess-001", user_id: USER_ID, answer_text: "The mobile handoff between wallet and form…", answer_type: "text", audio_url: null, audio_duration_seconds: null, transcription_confidence: null, score: 68, feedback: { summary: "Reasonable critique, thin on tradeoffs.", strengths: ["User-centric framing"], improvements: ["Quantify the impact", "Acknowledge constraints"] }, clarity_score: 74, structure_score: 66, relevance_score: 72, depth_score: 62, confidence_score: 70, time_taken_seconds: 232, created_at: daysAgo(3) },
]

const notifications = [
  { id: "n-001", user_id: USER_ID, type: "deadline", message: "Design Systems Engineer at Figma closes tomorrow", is_read: false, created_at: daysAgo(0), email_sent: false, email_sent_at: null, email_error: null },
  { id: "n-002", user_id: USER_ID, type: "status_update", message: "Stripe moved your application to Interview", is_read: false, created_at: daysAgo(1), email_sent: true, email_sent_at: daysAgo(1), email_error: null },
  { id: "n-003", user_id: USER_ID, type: "success", message: "Your CV analysis finished with a score of 84", is_read: false, created_at: daysAgo(2), email_sent: true, email_sent_at: daysAgo(2), email_error: null },
  { id: "n-004", user_id: USER_ID, type: "warning", message: "Resume_Backend.pdf could not be analyzed", is_read: true, created_at: daysAgo(3), email_sent: false, email_sent_at: null, email_error: null },
  { id: "n-005", user_id: USER_ID, type: "info", message: "New interview questions are available for Vercel", is_read: true, created_at: daysAgo(5), email_sent: false, email_sent_at: null, email_error: null },
  { id: "n-006", user_id: USER_ID, type: "status_update", message: "Monzo closed your application", is_read: true, created_at: daysAgo(19), email_sent: true, email_sent_at: daysAgo(19), email_error: null },
]

const users = [
  {
    id: USER_ID,
    email: "ada.okafor@example.com",
    full_name: "Ada Okafor",
    avatar_url: null,
    bio: "Frontend engineer focused on design systems and data-heavy product surfaces.",
    location: "Lagos, Nigeria",
    website: "https://adaokafor.dev",
    phone: "+234 801 555 0134",
    created_at: daysAgo(258),
    updated_at: daysAgo(1),
  },
]

const feedback = [
  { id: "fb-001", user_id: USER_ID, type: "feature", subject: "Bulk archive", message: "It would help to archive several applications at once.", status: "reviewed", created_at: daysAgo(14) },
  { id: "fb-002", user_id: USER_ID, type: "bug", subject: "Score circle on Safari", message: "The circle looked clipped on iOS Safari 17.", status: "resolved", created_at: daysAgo(40) },
]

const questions = interviewQuestions.map((q, i) => ({
  id: q.id, question_text: q.question_text, category: q.question_category,
  difficulty: q.difficulty, created_at: q.created_at, order_index: i + 1,
}))

const TABLES: Record<string, Record<string, unknown>[]> = {
  applications,
  documents,
  interview_sessions: interviewSessions,
  interview_questions: interviewQuestions,
  interview_answers: interviewAnswers,
  notifications,
  users,
  feedback,
  questions,
  application_notes: [
    { id: "note-001", application_id: "app-001", user_id: USER_ID, content: "Recruiter said the loop is 4 rounds; system design is the heaviest.", created_at: daysAgo(4) },
    { id: "note-002", application_id: "app-001", user_id: USER_ID, content: "Prep: re-read the payments idempotency docs.", created_at: daysAgo(2) },
  ],
  application_contacts: [
    { id: "c-001", application_id: "app-001", user_id: USER_ID, name: "Priya Raman", role: "Technical Recruiter", email: "priya@example.com", linkedin_url: null, notes: null, created_at: daysAgo(9) },
  ],
  application_documents: [
    { id: "ad-001", application_id: "app-001", document_id: "doc-001", user_id: USER_ID, created_at: daysAgo(9) },
    { id: "ad-002", application_id: "app-001", document_id: "doc-002", user_id: USER_ID, created_at: daysAgo(9) },
  ],
  document_analyses: [],
  status_history: [],
  resume_versions: [
    { id: "rv-001", user_id: USER_ID, document_id: "doc-001", version: 3, created_at: daysAgo(24) },
  ],
  ai_retry_queue: [],
  company_interview_templates: [],
  conversation_turns: [],
}

// ---------------------------------------------------------------- mock client
type Result = { data: unknown; error: unknown; count?: number }

/** Applies the subset of the PostgREST chain the services use. */
function runQuery(
  table: string,
  state: {
    filters: [string, unknown][]
    orders: [string, boolean][]
    limit: number | null
    op: string
    payload: unknown
    embedApplication: boolean
  }
) {
  let rows = [...(TABLES[table] ?? [])]

  for (const [col, val] of state.filters) {
    if (col === "__in") {
      const [field, list] = val as [string, unknown[]]
      rows = rows.filter((r) => list.includes(r[field]))
    } else if (col === "__or") {
      // "(id.eq.x,id.eq.y)" style — only equality branches appear in this app
      const expr = String(val).replace(/^\(|\)$/g, "")
      const branches = expr.split(",").map((b) => b.split(".eq."))
      rows = rows.filter((r) => branches.some(([f, v]) => String(r[f]) === String(v)))
    } else {
      rows = rows.filter((r) => r[col] === val)
    }
  }

  for (const [col, asc] of state.orders) {
    rows.sort((a, b) => {
      const av = a[col] ?? ""
      const bv = b[col] ?? ""
      if (av === bv) return 0
      return (av > bv ? 1 : -1) * (asc ? 1 : -1)
    })
  }
  if (state.limit != null) rows = rows.slice(0, state.limit)

  // PostgREST embed: `application:applications(*)` returns a nested row
  if (state.embedApplication && table === "interview_sessions") {
    rows = rows.map((r) => ({
      ...r,
      application: applications.find((a) => a.id === r.application_id) ?? null,
    }))
  }

  if (state.op === "insert") {
    const inserted = (Array.isArray(state.payload) ? state.payload : [state.payload]).map((p, i) => ({
      id: `${table}-preview-${Date.now()}-${i}`,
      created_at: new Date().toISOString(),
      ...(p as object),
    }))
    TABLES[table] = [...(TABLES[table] ?? []), ...inserted]
    return { data: inserted, error: null }
  }
  if (state.op === "update") {
    const updated = rows.map((r) => ({ ...r, ...(state.payload as object) }))
    TABLES[table] = (TABLES[table] ?? []).map((r) => updated.find((u) => u.id === r.id) ?? r)
    return { data: updated, error: null }
  }
  if (state.op === "delete") {
    const ids = new Set(rows.map((r) => r.id))
    TABLES[table] = (TABLES[table] ?? []).filter((r) => !ids.has(r.id))
    return { data: rows, error: null }
  }
  return { data: rows, error: null }
}

function createQuery(table: string) {
  const state = {
    filters: [] as [string, unknown][],
    orders: [] as [string, boolean][],
    limit: null as number | null,
    op: "select",
    payload: null as unknown,
    single: false,
    maybeSingle: false,
    embedApplication: false,
  }

  const resolve = (): Result => {
    const res = runQuery(table, state) as { data: unknown; error: unknown }
    if (state.single) {
      const arr = Array.isArray(res.data) ? res.data : []
      // `single()` errors on an empty result, `maybeSingle()` returns null
      if (state.maybeSingle) return { data: arr[0] ?? null, error: null }
      return { data: arr[0] ?? null, error: arr.length ? null : { message: "Row not found", code: "PGRST116" } }
    }
    return res
  }

  const builder: Record<string, unknown> = {}
  const chain =
    (fn: (args: unknown[]) => void) =>
    (...args: unknown[]) => {
      fn(args)
      return builder
    }

  Object.assign(builder, {
    select: chain(([cols]) => {
      if (typeof cols === "string" && /application:applications/.test(cols)) state.embedApplication = true
    }),
    order: chain(([col, opts]) => state.orders.push([col as string, (opts as { ascending?: boolean })?.ascending !== false])),
    limit: chain(([n]) => (state.limit = n as number)),
    eq: chain(([col, val]) => state.filters.push([col as string, val])),
    neq: chain(([col, val]) => state.filters.push([`__neq_${col}`, val])),
    in: chain(([col, list]) => state.filters.push(["__in", [col as string, list as unknown[]]])),
    or: chain(([expr]) => state.filters.push(["__or", expr])),
    gte: chain(() => {}),
    lte: chain(() => {}),
    is: chain(() => {}),
    ilike: chain(() => {}),
    maybeSingle: () => {
      state.single = true
      state.maybeSingle = true
      return Promise.resolve(resolve())
    },
    single: () => {
      state.single = true
      return Promise.resolve(resolve())
    },
    insert: chain(([payload]) => {
      state.op = "insert"
      state.payload = payload
    }),
    update: chain(([payload]) => {
      state.op = "update"
      state.payload = payload
    }),
    upsert: chain(([payload]) => {
      state.op = "insert"
      state.payload = payload
    }),
    delete: chain(() => {
      state.op = "delete"
    }),
    then: (onFulfilled: (v: Result) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(resolve()).then(onFulfilled, onRejected),
  })

  return builder
}

const subscriptions = new Set<() => void>()

let cachedClient: unknown = null

export function createPreviewClient() {
  // Mirror createBrowserClient's singleton: the settings page lists the client
  // in a useEffect dependency array, so a fresh object per call would loop
  // forever (that is exactly how this harness first "broke" /settings).
  if (cachedClient) return cachedClient

  const listeners = new Set<(event: string, session: unknown) => void>()
  const session = { access_token: "preview-token", token_type: "bearer", expires_in: 3600, refresh_token: "preview-refresh", user: previewUser }

  const client = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user: previewUser }, error: null }),
      onAuthStateChange: (cb: (event: string, s: unknown) => void) => {
        listeners.add(cb)
        const unsub = () => {
          listeners.delete(cb)
          subscriptions.delete(unsub)
        }
        subscriptions.add(unsub)
        return { data: { subscription: { unsubscribe: unsub } } }
      },
      signInWithPassword: async () => ({ data: { session, user: previewUser }, error: null }),
      signUp: async () => ({ data: { session, user: previewUser }, error: null }),
      signInWithOAuth: async () => ({ data: { provider: "google", url: null }, error: null }),
      signOut: async () => {
        listeners.forEach((cb) => cb("SIGNED_OUT", null))
        return { error: null }
      },
      updateUser: async () => ({ data: { user: previewUser }, error: null }),
      setSession: async () => ({ data: { session }, error: null }),
      exchangeCodeForSession: async () => ({ data: { session }, error: null }),
    },
    from: (table: string) => createQuery(table),
    storage: {
      from: () => ({
        upload: async () => ({ data: { path: "preview/upload" }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "/preview/placeholder.pdf" } }),
        remove: async () => ({ data: null, error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: "/preview/placeholder.pdf" }, error: null }),
      }),
    },
    channel: () => {
      const ch = {
        on: () => ch,
        subscribe: () => ch,
        unsubscribe: async () => ({ error: null }),
      }
      return ch
    },
    removeChannel: async () => ({ error: null }),
  }

  cachedClient = client
  return client as unknown as ReturnType<typeof import("@supabase/ssr").createBrowserClient>
}

export function isPreviewRequest() {
  return PREVIEW_ENABLED
}
