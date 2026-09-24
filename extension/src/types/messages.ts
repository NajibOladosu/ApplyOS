/**
 * Versioned message protocol for the Universal Autofill Engine.
 *
 * Spec: extension/AUTOFILL_ARCHITECTURE.md section 8.4.
 *
 * This is the first file in extension/src/types/. Existing types are colocated
 * (PageDetectionResult in page-detector.ts:1-9, ExtractedData in
 * data-extractor.ts:10-23, ExtractedQuestion in question-extractor.ts:1-6),
 * which is right for those — they belong to one module each. The message
 * envelope is genuinely cross-cutting: it is shared by the content script, the
 * service worker, the popup and the MAIN-world bridge.
 *
 * tsconfig.json:15 sets isolatedModules, so every type re-export must be
 * `export type`.
 */

import type {
  AtsId,
  FieldDescriptor,
  FillPlanPublic,
  FillPlanPreview,
  FillResult,
  FillValue,
} from '@shared/autofill/types'

export type {
  AtsId,
  FieldDescriptor,
  FillPlanPublic,
  FillPlanPreview,
  FillResult,
  FillValue,
}

export const PROTOCOL_VERSION = 1 as const
export type ProtocolVersion = typeof PROTOCOL_VERSION

/**
 * `aos: 1` is the brand. It exists so that foreign listeners — including the
 * legacy EXTRACT_PAGE listener in content/index.tsx, which shares the frame —
 * can decline a message that is not theirs instead of answering it wrongly.
 */
export interface RuntimeEnvelope<B> {
  aos: 1
  v: ProtocolVersion
  id: string
  body: B
}

export type AosErrorCode =
  | 'NOT_SIGNED_IN'
  | 'TOKEN_REFRESH_FAILED'
  | 'PROFILE_INCOMPLETE'
  | 'NO_HOST_PERMISSION'
  | 'FRAME_GONE'
  | 'BRIDGE_TIMEOUT'
  | 'BRIDGE_UNAVAILABLE'
  | 'PLAN_EMPTY'
  | 'ABORTED_BY_USER'
  | 'SENSITIVE_BLOCKED'
  | 'NETWORK'
  | 'RATE_LIMITED'
  | 'PROTOCOL_VERSION_MISMATCH'
  | 'UNSUPPORTED_CONTROL'
  | 'UNKNOWN'

export interface AosError {
  t: 'SW_ERROR'
  code: AosErrorCode
  message: string
  fid?: string
}

export type RunState =
  | 'DETECT'
  | 'RESOLVE_PROFILE'
  | 'BUILD_PLAN'
  | 'PREVIEW'
  | 'APPLY'
  | 'REPORT'
  | 'FAILED'
  | 'ABORTED'

/** A frame that reported itself scannable. Ranked by fieldCount when targeting. */
export interface FrameRecord {
  tabId: number
  frameId: number
  ats: AtsId
  /** origin + pathname only. */
  url: string
  hasForm: boolean
  fieldCount: number
  isTopFrame: boolean
  seenAt: number
}

// ── content -> SW (one-shot, sendMessage) ───────────────────────────────────

export type CsToSwBody =
  | { t: 'AOS_FRAME_HELLO'; ats: AtsId; url: string; hasForm: boolean; fieldCount: number; isTopFrame: boolean }
  | { t: 'SW_AUTH_STATUS' }
  | { t: 'SW_PROFILE_GET'; force?: boolean }
  | { t: 'SW_PLAN_SUBMIT'; runId: string; plan: FillPlanPublic; descriptors: FieldDescriptor[] }
  /** One field, one value, at APPLY time. Never the whole profile. */
  | { t: 'SW_DISPENSE'; runId: string; fieldId: string }
  | { t: 'SW_RESUME_BLOB'; documentId: string }
  | { t: 'SW_RUN_PROGRESS'; runId: string; state: RunState; filled: number; total: number }
  | { t: 'SW_RUN_REPORT'; runId: string; result: FillResult }

export type SwToCsResponseBody =
  | { t: 'SW_AUTH_STATUS_OK'; signedIn: boolean; userId: string | null }
  | { t: 'SW_PROFILE_OK'; profile: unknown; stamp: string; source: 'cache' | 'network' }
  | { t: 'SW_DISPENSE_OK'; fieldId: string; value: FillValue }
  | { t: 'SW_RESUME_BLOB_OK'; fileName: string; mimeType: string; base64: string; bytes: number }
  | { t: 'SW_ACK' }
  | AosError

// ── SW -> content (push; ALWAYS with { frameId }) ───────────────────────────

export type SwToCsPushBody =
  | { t: 'CS_RUN_BEGIN'; runId: string; applicationId: string | null; allowSensitive: boolean }
  /** Carries no values. Each is dispensed individually via SW_DISPENSE. */
  | { t: 'CS_APPLY'; runId: string; acceptedFieldIds: string[] }
  | { t: 'CS_ABORT'; runId: string; reason: AosErrorCode }
  | { t: 'CS_PROFILE_INVALIDATED' }
  | { t: 'CS_AUDIT' }

export type CsToSwPushResponseBody = { t: 'CS_ACK' } | AosError

// ── popup <-> SW (long-lived port) ──────────────────────────────────────────

export const RUN_PORT = 'aos.run' as const

export type PopupToSwBody =
  | { t: 'RUN_START'; tabId: number; applicationId: string | null; allowSensitive: boolean }
  | { t: 'RUN_APPROVE'; runId: string; acceptedFieldIds: string[]; rejectedFieldIds: string[] }
  | { t: 'RUN_ABORT'; runId: string }
  | { t: 'RUN_SUBSCRIBE'; runId: string }

export type SwToPopupBody =
  | { t: 'RUN_STATE'; runId: string; state: RunState; ats: AtsId; frames: number }
  /** Values here. The popup is extension chrome; the page never sees this shape. */
  | { t: 'RUN_PLAN'; runId: string; plan: FillPlanPreview }
  | { t: 'RUN_PROGRESS'; runId: string; filled: number; total: number }
  | { t: 'RUN_DONE'; runId: string; result: FillResult }
  | { t: 'RUN_FAILED'; runId: string; code: AosErrorCode; message: string }

// ── helpers ─────────────────────────────────────────────────────────────────

export function envelope<B>(body: B): RuntimeEnvelope<B> {
  return { aos: 1, v: PROTOCOL_VERSION, id: crypto.randomUUID(), body }
}

export function isAosEnvelope(m: unknown): m is RuntimeEnvelope<unknown> {
  if (!m || typeof m !== 'object') return false
  const c = m as Partial<RuntimeEnvelope<unknown>>
  return c.aos === 1 && typeof c.id === 'string' && typeof c.v === 'number'
}

/**
 * A content script from an older build talking to a newer service worker must
 * fail loudly rather than half-work: the field-mapping semantics are exactly
 * the kind of thing that changes between versions.
 */
export function assertVersion(m: RuntimeEnvelope<unknown>): void {
  if (m.v !== PROTOCOL_VERSION) {
    const err = new Error(`autofill protocol v${m.v} != v${PROTOCOL_VERSION}`)
    ;(err as Error & { code: AosErrorCode }).code = 'PROTOCOL_VERSION_MISMATCH'
    throw err
  }
}

export function aosError(code: AosErrorCode, message: string, fid?: string): AosError {
  return { t: 'SW_ERROR', code, message, ...(fid ? { fid } : {}) }
}
