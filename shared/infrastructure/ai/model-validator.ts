import 'server-only'

const MODELS_LIST_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const FETCH_TIMEOUT_MS = 8000

interface ValidatorState {
  models: Set<string> | null
  fetchedAt: number
  inFlight: Promise<Set<string> | null> | null
  lastError: string | null
}

const state: ValidatorState = {
  models: null,
  fetchedAt: 0,
  inFlight: null,
  lastError: null,
}

interface GeminiModelEntry {
  name: string
  supportedGenerationMethods?: string[]
}

interface GeminiModelsResponse {
  models?: GeminiModelEntry[]
  nextPageToken?: string
}

function normalizeModelName(name: string): string {
  return name.startsWith('models/') ? name : `models/${name}`
}

async function fetchAvailableModels(apiKey: string): Promise<Set<string> | null> {
  const collected = new Set<string>()
  let pageToken: string | undefined

  for (let page = 0; page < 10; page++) {
    const url = new URL(MODELS_LIST_URL)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('pageSize', '100')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) {
        state.lastError = `models.list HTTP ${res.status}`
        console.warn(`[ModelValidator] ${state.lastError}`)
        return null
      }
      const data = (await res.json()) as GeminiModelsResponse
      for (const m of data.models ?? []) {
        if (!m?.name) continue
        const methods = m.supportedGenerationMethods ?? []
        if (methods.length === 0 || methods.includes('generateContent')) {
          collected.add(normalizeModelName(m.name))
        }
      }
      pageToken = data.nextPageToken
      if (!pageToken) break
    } catch (err) {
      state.lastError = err instanceof Error ? err.message : String(err)
      console.warn(`[ModelValidator] fetch failed: ${state.lastError}`)
      return null
    } finally {
      clearTimeout(timeout)
    }
  }

  state.lastError = null
  return collected
}

async function refreshIfStale(): Promise<Set<string> | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const now = Date.now()
  const fresh = state.models && now - state.fetchedAt < CACHE_TTL_MS
  if (fresh) return state.models

  if (state.inFlight) return state.inFlight

  state.inFlight = (async () => {
    try {
      const result = await fetchAvailableModels(apiKey)
      if (result && result.size > 0) {
        state.models = result
        state.fetchedAt = Date.now()
        console.log(`[ModelValidator] cached ${result.size} models from Gemini API`)
      }
      return state.models
    } finally {
      state.inFlight = null
    }
  })()

  return state.inFlight
}

export async function getValidatedModels(): Promise<Set<string> | null> {
  return refreshIfStale()
}

export function getValidatedModelsSync(): Set<string> | null {
  if (state.models && Date.now() - state.fetchedAt < CACHE_TTL_MS) {
    return state.models
  }
  void refreshIfStale()
  return state.models
}

export async function isModelAvailable(model: string): Promise<boolean> {
  const set = await getValidatedModels()
  if (!set) return true // fail open if validation unavailable
  return set.has(normalizeModelName(model))
}

export function isModelAvailableSync(model: string): boolean {
  const set = getValidatedModelsSync()
  if (!set) return true // fail open
  return set.has(normalizeModelName(model))
}

export function _resetModelValidatorForTests(): void {
  state.models = null
  state.fetchedAt = 0
  state.inFlight = null
  state.lastError = null
}

export function getValidatorStatus(): { cached: number; ageMs: number | null; lastError: string | null } {
  return {
    cached: state.models?.size ?? 0,
    ageMs: state.fetchedAt ? Date.now() - state.fetchedAt : null,
    lastError: state.lastError,
  }
}
