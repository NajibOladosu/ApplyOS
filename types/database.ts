import type { ParsedDocument } from "@/shared/infrastructure/ai"
import type { ResumeAnalysisResult } from "@/modules/applications/components/resume-feedback"
import type { ProfileKey } from "@/shared/autofill/types"

export type ApplicationStatus = 'draft' | 'submitted' | 'in_review' | 'interview' | 'offer' | 'rejected'
export type ApplicationPriority = 'low' | 'medium' | 'high'
export type ApplicationType = 'job' | 'scholarship' | 'internship' | 'other'
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'deadline' | 'status_update'
export type FeedbackType = 'general' | 'bug' | 'feature'
export type FeedbackStatus = 'pending' | 'reviewed' | 'resolved'

export interface ReportCategory {
  name: string
  score: number
  strengths: string[]
  improvements: string[]
}

export interface DocumentReport {
  documentType: string
  overallScore: number
  overallAssessment: string
  categories: ReportCategory[]
}

export interface User {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  email_verified: boolean | null
  verification_token: string | null
  verification_token_expires_at: string | null
  last_verification_email_sent: string | null
  created_at: string
  updated_at: string
}

export interface Application {
  id: string
  user_id: string
  title: string
  company: string | null
  url: string | null
  status: ApplicationStatus
  priority: ApplicationPriority
  type: ApplicationType
  deadline: string | null
  job_description: string | null
  ai_cover_letter: string | null
  manual_cover_letter: string | null
  last_analyzed_document_id: string | null
  archived: boolean
  created_at: string
  updated_at: string
}

export interface Question {
  id: string
  application_id: string
  question_text: string
  ai_answer: string | null
  manual_answer: string | null
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  user_id: string
  file_name: string
  file_url: string
  file_type: string | null
  file_size: number | null
  parsed_data: ParsedDocument | null
  version: number
  created_at: string
  updated_at: string
  report: DocumentReport | null
  report_generated_at: string | null
  analysis_status: 'not_analyzed' | 'pending' | 'success' | 'failed'
  analysis_error: string | null
  parsed_at: string | null
  application_id: string | null
  extracted_text: string | null
  analysis_result: ResumeAnalysisResult | null
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  message: string
  is_read: boolean
  created_at: string
  email_sent?: boolean
  email_sent_at?: string | null
  email_error?: string | null
}

export interface StatusHistory {
  id: string
  application_id: string
  old_status: string | null
  new_status: string
  changed_by: string | null
  timestamp: string
}

export interface Feedback {
  id: string
  user_id: string
  type: FeedbackType
  title: string
  description: string
  status: FeedbackStatus
  created_at: string
  updated_at: string
}

export interface ApplicationNote {
  id: string
  application_id: string
  user_id: string
  content: string
  category: string | null
  is_pinned: boolean
  created_at: string
  updated_at: string
}

export interface ApplicationContact {
  id: string
  application_id: string
  user_id: string
  name: string
  role: string | null
  email: string | null
  linkedin_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// Interview feature types
export type SessionType = 'behavioral' | 'technical' | 'company_specific' | 'mixed' | 'resume_grill'
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned'
export type InterviewDifficulty = 'easy' | 'medium' | 'hard'
export type AnswerType = 'voice' | 'text'

export type QuestionCategory =
  | 'behavioral_leadership'
  | 'behavioral_teamwork'
  | 'behavioral_conflict'
  | 'behavioral_failure'
  | 'technical_coding'
  | 'technical_system_design'
  | 'technical_algorithms'
  | 'company_culture'
  | 'company_values'
  | 'resume_specific'
  | 'other'


export interface IdealAnswerOutline {
  structure: string
  keyPoints: string[]
  exampleMetrics?: string[]
  commonPitfalls?: string[]
}

export interface EvaluationCriteria {
  mustInclude?: string[]
  bonusPoints?: string[]
  redFlags?: string[]
}

export interface InterviewFeedback {
  overall: string
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  tone_analysis?: string  // Analysis of communication style and delivery
  rubric?: Record<string, number>  // Optional per-dimension rubric scores
}

export interface ScoreBreakdown {
  clarity: number
  structure: number
  relevance: number
  depth: number
  confidence: number
}

export interface InterviewSession {
  id: string
  application_id: string
  user_id: string
  session_type: SessionType
  company_name: string | null
  difficulty: InterviewDifficulty | null
  status: SessionStatus
  started_at: string
  completed_at: string | null
  total_questions: number
  answered_questions: number
  average_score: number | null
  total_duration_seconds: number | null
  conversation_mode: boolean
  full_transcript: ConversationTurn[] | null
  conversation_started_at: string | null
  conversation_ended_at: string | null
  created_at: string
  updated_at: string
}

export interface InterviewQuestion {
  id: string
  session_id: string
  user_id: string
  question_text: string
  question_category: QuestionCategory
  difficulty: InterviewDifficulty | null
  ideal_answer_outline: IdealAnswerOutline | null
  evaluation_criteria: EvaluationCriteria | null
  question_order: number
  estimated_duration_seconds: number
  created_at: string
}

export interface InterviewAnswer {
  id: string
  question_id: string
  session_id: string
  user_id: string
  answer_text: string
  answer_type: AnswerType
  audio_url: string | null
  audio_duration_seconds: number | null
  transcription_confidence: number | null
  score: number
  feedback: InterviewFeedback
  clarity_score: number | null
  structure_score: number | null
  relevance_score: number | null
  depth_score: number | null
  confidence_score: number | null
  time_taken_seconds: number | null
  answered_at: string
  created_at: string
}

export interface InterviewAnalytics {
  id: string
  user_id: string
  application_id: string | null
  period_start: string
  period_end: string
  total_sessions: number
  total_questions: number
  total_answers: number
  average_score: number | null
  average_clarity_score: number | null
  average_structure_score: number | null
  average_relevance_score: number | null
  average_depth_score: number | null
  average_confidence_score: number | null
  scores_by_category: Record<string, number> | null
  top_strengths: string[] | null
  common_weaknesses: string[] | null
  score_trend: Array<{ date: string; score: number }> | null
  created_at: string
  updated_at: string
}

export interface TemplateQuestion {
  text: string
  category: QuestionCategory
  difficulty: InterviewDifficulty
  idealOutline: IdealAnswerOutline
  evaluationCriteria: EvaluationCriteria
  estimatedDurationSeconds: number
  tags?: string[]
}

export interface CompanyTemplate {
  id: string
  company_name: string
  company_slug: string
  job_role: string | null
  interview_round: string | null
  questions: TemplateQuestion[]
  description: string | null
  tips: string[] | null
  times_used: number
  last_used_at: string | null
  created_at: string
  updated_at: string
}

export interface ConversationTurn {
  id: string
  session_id: string
  user_id: string
  turn_number: number
  speaker: 'ai' | 'user'
  content: string
  audio_url: string | null
  audio_duration_seconds: number | null
  timestamp: string
  metadata: ConversationTurnMetadata | null
  created_at: string
}

export interface ConversationTurnMetadata {
  type?: string
  questionNumber?: number
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Autofill profile — 033_create_user_profiles.sql
// ---------------------------------------------------------------------------
// One interface per table, column for column. Nullability follows the DDL, not
// what the UI happens to always send: a column without NOT NULL is `| null`
// here even when every current writer fills it.

/** 033:100 */
export type PhoneType = 'mobile' | 'home' | 'work'

/** 033:120-123 */
export type VisaStatus =
  | 'citizen'
  | 'permanent_resident'
  | 'work_visa_h1b'
  | 'work_visa_other'
  | 'student_opt'
  | 'student_cpt'
  | 'tn'
  | 'e3'
  | 'other'
  | 'decline_to_state'

/** 033:128 */
export type RemotePreference = 'onsite' | 'hybrid' | 'remote' | 'flexible'

/** 033:137 */
export type SalaryPeriod = 'hourly' | 'monthly' | 'annual'

/** One element of user_profiles.other_links (033:217-218). */
export interface OtherLink {
  label: string
  url: string
}

/** One element of user_profiles.additional_work_authorizations (033:214-215). */
export interface AdditionalWorkAuthorization {
  /** ISO-3166-1 alpha-2, same vocabulary as work_authorization_country (033:117). */
  country: string
  authorized: boolean
  requires_sponsorship: boolean
}

/** One element of user_profiles.languages (033:220-221). */
export interface LanguageProficiency {
  language: string
  proficiency: string
}

/**
 * user_profiles.autofill_overrides (033:205-206): field-signature hash ->
 * canonical key, or '__skip__' meaning "never fill this field".
 *
 * Unlike visa_status or remote_preference, no CHECK constraint keeps this
 * vocabulary closed — the column is checked only for `jsonb_typeof = 'object'`
 * (033:176-177). The literal type describes what this app writes; anything read
 * back out must still pass isProfileKey() (shared/autofill/types.ts:91) before
 * the engine acts on it.
 */
export type AutofillOverrides = Record<string, ProfileKey | '__skip__'>

export type ProvenanceSource = 'user' | 'resume_import' | 'ats_capture'

/** One entry of user_profiles.field_provenance (033:208-209). */
export interface FieldProvenanceEntry {
  source: ProvenanceSource
  /** 0.0–1.0. */
  confidence: number
  /** ISO-8601. */
  updated_at: string
  verified: boolean
}

/**
 * The five canonical keys that may never appear in field_provenance.
 *
 * trg_user_profiles_validate raises 22023 on any of them (033:463-507):
 * user_profiles is the table `authenticated` reads directly over PostgREST, so
 * an EEO key there — even as a provenance entry with no answer beside it —
 * reintroduces exactly the leak the user_profile_eeo split exists to prevent.
 * These are the 'protected' keys of shared/autofill/types.ts:160-164.
 */
export type EeoProfileKey =
  | 'gender'
  | 'race_ethnicity'
  | 'hispanic_latino'
  | 'veteran_status'
  | 'disability_status'

export type ProvenanceKey = Exclude<ProfileKey, EeoProfileKey>

export type FieldProvenance = Partial<Record<ProvenanceKey, FieldProvenanceEntry>>

export interface UserProfile {
  /** PRIMARY KEY — this table is 1:1 with public.users, with no surrogate id (033:42-45). */
  user_id: string

  legal_first_name: string | null
  legal_middle_name: string | null
  legal_last_name: string | null
  preferred_first_name: string | null
  name_suffix: string | null
  pronouns: string | null

  contact_email: string | null
  phone_country_code: string | null
  phone_number: string | null
  phone_type: PhoneType | null

  address_line1: string | null
  address_line2: string | null
  address_city: string | null
  address_state: string | null
  address_postal_code: string | null
  /** ISO-3166-1 alpha-2, CHECK-constrained to `^[A-Z]{2}$` (033:108). */
  address_country: string | null

  linkedin_url: string | null
  github_url: string | null
  portfolio_url: string | null
  /** NOT NULL DEFAULT '[]' — absent means `[]`, never null. */
  other_links: OtherLink[]

  work_authorization_country: string | null
  work_authorized: boolean | null
  requires_sponsorship: boolean | null
  visa_status: VisaStatus | null
  additional_work_authorizations: AdditionalWorkAuthorization[]

  willing_to_relocate: boolean | null
  remote_preference: RemotePreference | null
  /** DATE — PostgREST serializes it as 'YYYY-MM-DD', not a timestamp. */
  earliest_start_date: string | null
  /** CHECK 0–365 (033:130). */
  notice_period_days: number | null
  /** Stored in place of date_of_birth — forms ask the age gate, not the DOB (033:223-224). */
  is_over_18: boolean | null

  desired_salary_min: number | null
  desired_salary_max: number | null
  /** ISO-4217, CHECK-constrained to `^[A-Z]{3}$` (033:136). */
  desired_salary_currency: string | null
  desired_salary_period: SalaryPeriod | null

  has_security_clearance: boolean | null
  security_clearance_level: string | null
  languages: LanguageProficiency[]

  default_how_did_you_hear: string | null
  /** FK public.documents, and the row's own user must own it (033:473-479). */
  default_resume_document_id: string | null
  default_cover_letter_document_id: string | null

  autofill_enabled: boolean
  /** NOT NULL DEFAULT TRUE — the server-side record of "never click submit" (033:211-212). */
  autofill_never_submit: boolean
  autofill_overrides: AutofillOverrides

  field_provenance: FieldProvenance
  resume_import_document_id: string | null
  resume_imported_at: string | null

  /** DEFAULT now() but NOT declared NOT NULL (033:159-160), so an explicit NULL is storable. */
  created_at: string | null
  updated_at: string | null
}

// ---------------------------------------------------------------------------
// Voluntary EEO self-identification — 033_create_user_profiles.sql
// ---------------------------------------------------------------------------
// Unreachable from the browser by design: `authenticated` holds no privilege on
// public.user_profile_eeo and no EXECUTE on the four RPCs (033:749-757). Any
// code handling this type runs server-side with the service-role client.
//
// NULL and 'decline_to_self_identify' are different facts and must never be
// COALESCEd together (033:347-348): NULL = never answered, so the engine leaves
// the field blank and flags it; 'decline_to_self_identify' = answered "decline",
// so the engine selects the decline option.

export type EeoGender = 'male' | 'female' | 'non_binary' | 'decline_to_self_identify'

export type EeoHispanicOrLatino = 'yes' | 'no' | 'decline_to_self_identify'

export type EeoRace =
  | 'american_indian_or_alaska_native'
  | 'asian'
  | 'black_or_african_american'
  | 'native_hawaiian_or_other_pacific_islander'
  | 'white'
  | 'two_or_more_races'
  | 'decline_to_self_identify'

export type EeoVeteranStatus =
  | 'not_a_protected_veteran'
  | 'protected_veteran'
  | 'decline_to_self_identify'

export type EeoDisabilityStatus = 'yes' | 'no' | 'decline_to_self_identify'

export interface UserProfileEeo {
  user_id: string
  /**
   * ISO-3166-1 alpha-2 country whose vocabulary the answers belong to
   * (US EEO-1 / VEVRAA / CC-305). NOT NULL DEFAULT 'US' (033:300-301, 353-354).
   */
  jurisdiction: string
  gender: EeoGender | null
  hispanic_or_latino: EeoHispanicOrLatino | null
  race: EeoRace | null
  veteran_status: EeoVeteranStatus | null
  disability_status: EeoDisabilityStatus | null
  /** Which CC-305 revision was answered, so a stale answer is detectable (033:326-329). */
  disability_form_version: string | null
  /** Opt-in, NOT NULL DEFAULT FALSE. The SQL gate, not a client-side check (033:350-351). */
  autofill_eeo_enabled: boolean
  /** Moves with consent in both directions — CHECK-enforced (033:339-341). */
  consented_at: string | null
  created_at: string | null
  updated_at: string | null
}

// ---------------------------------------------------------------------------
// Career history — migration 034_create_user_career_history.sql
// ---------------------------------------------------------------------------

/**
 * Precision of a career date.
 *
 * Resume text yields "2020"; a user editing the profile yields 2020-03; a Workday
 * month picker demands a month. The DATE column stores day = 01 by convention and
 * this field records how much of it is actually known, so the fill engine can tell
 * "March 2020" from "sometime in 2020" instead of silently asserting January.
 */
export type CareerDatePrecision = 'year' | 'month' | 'day'

/**
 * Where a row came from. `verified_at IS NOT NULL` is what the resume importer
 * checks before it will overwrite a row — the user always wins.
 */
export type CareerRecordSource = 'user' | 'resume_import' | 'ats_capture'

export type DegreeLevel =
  | 'high_school'
  | 'associate'
  | 'bachelor'
  | 'master'
  | 'doctorate'
  | 'professional'
  | 'certificate'
  | 'other'

export interface UserWorkHistory {
  id: string
  user_id: string
  sort_order: number
  company: string
  job_title: string | null
  location_city: string | null
  location_state: string | null
  location_country: string | null
  is_current: boolean
  start_date: string | null
  start_date_precision: CareerDatePrecision | null
  end_date: string | null
  end_date_precision: CareerDatePrecision | null
  description: string | null
  reason_for_leaving: string | null
  /** Taleo and iCIMS itemised widgets ask this explicitly. */
  may_contact_employer: boolean | null
  source: CareerRecordSource
  source_document_id: string | null
  source_confidence: number | null
  verified_at: string | null
  created_at: string
  updated_at: string
}

export interface UserEducation {
  id: string
  user_id: string
  sort_order: number
  school: string
  degree: string | null
  degree_level: DegreeLevel | null
  field_of_study: string | null
  is_current: boolean
  start_date: string | null
  start_date_precision: CareerDatePrecision | null
  end_date: string | null
  end_date_precision: CareerDatePrecision | null
  /** Paired with gpa_scale: "3.7" is meaningless without knowing it is out of 4.0. */
  gpa: number | null
  gpa_scale: number | null
  source: CareerRecordSource
  source_document_id: string | null
  source_confidence: number | null
  verified_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Return shape of public.get_autofill_bundle() (migration 034) — the single read
 * the fill engine performs.
 *
 * `eeo` is null unless the user has explicitly opted in
 * (user_profile_eeo.autofill_eeo_enabled). That gate is enforced in SQL, not here:
 * the extension holds the user's JWT and talks to PostgREST directly, so a
 * client-side check would not be a gate at all.
 */
export interface AutofillBundle {
  profile: Omit<UserProfile, 'autofill_overrides'>
  overrides: AutofillOverrides
  work: UserWorkHistory[]
  education: UserEducation[]
  eeo: UserProfileEeo | null
}
