import 'server-only'

export type AICallStatus = 'success' | 'rate_limited' | 'server_error' | 'client_error' | 'failed'

export interface AICallTelemetry {
  ts: string
  event: 'ai.call'
  complexity: 'SIMPLE' | 'MEDIUM' | 'COMPLEX'
  model: string | null
  attempt: number
  total_attempts: number
  latency_ms: number
  retries: number
  fallback_path: string[]
  status: AICallStatus
  http_status?: number | null
  error_class?: string
  error_message?: string
  prompt_chars?: number
  response_chars?: number
}

export function logAICall(record: AICallTelemetry): void {
  try {
    console.log(JSON.stringify(record))
  } catch {
    console.log('[AI] telemetry serialize failed', record.event, record.status)
  }
}

export type ErrorCategory = 'rate_limit' | 'server_error' | 'client_error' | 'unknown'

export interface ClassifiedError {
  category: ErrorCategory
  status: number | null
  retryable: boolean
  message: string
}

const RATE_LIMIT_STATUSES = new Set([429, 503])

export function classifyError(error: any): ClassifiedError {
  const message = String(error?.message ?? error?.toString() ?? '')
  const lower = message.toLowerCase()

  let status: number | null = typeof error?.status === 'number' ? error.status : null
  if (status == null) {
    const match = lower.match(/\b(4\d{2}|5\d{2})\b/)
    if (match) status = parseInt(match[1], 10)
  }

  const overloadKeywords =
    lower.includes('overloaded') ||
    lower.includes('service unavailable') ||
    lower.includes('rate limit') ||
    lower.includes('quota exceeded')

  if (status != null && RATE_LIMIT_STATUSES.has(status)) {
    return { category: 'rate_limit', status, retryable: true, message }
  }
  if (overloadKeywords) {
    return { category: 'rate_limit', status, retryable: true, message }
  }
  if (status != null && status >= 500 && status < 600) {
    return { category: 'server_error', status, retryable: true, message }
  }
  if (status != null && status >= 400 && status < 500) {
    return { category: 'client_error', status, retryable: false, message }
  }

  return { category: 'unknown', status, retryable: false, message }
}
