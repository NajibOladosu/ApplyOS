import 'server-only'
import { GoogleGenerativeAI, type GenerativeModel, type GenerationConfig } from '@google/generative-ai'

let _client: GoogleGenerativeAI | null = null
const _modelCache = new Map<string, GenerativeModel>()

export function getGeminiClient(): GoogleGenerativeAI | null {
  if (_client) return _client
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  _client = new GoogleGenerativeAI(apiKey)
  return _client
}

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY
}

export function getGenerativeModel(
  model: string,
  generationConfig?: GenerationConfig
): GenerativeModel {
  const client = getGeminiClient()
  if (!client) {
    throw new Error('Gemini client not configured: GEMINI_API_KEY missing')
  }
  const cacheKey = `${model}::${JSON.stringify(generationConfig ?? {})}`
  const cached = _modelCache.get(cacheKey)
  if (cached) return cached
  const instance = client.getGenerativeModel({ model, generationConfig })
  _modelCache.set(cacheKey, instance)
  return instance
}

export function _resetGeminiClientForTests(): void {
  _client = null
  _modelCache.clear()
}
