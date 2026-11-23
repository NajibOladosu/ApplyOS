import 'server-only'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { AIConnectionError, type AIProvider } from './connections'

const MODELS: Record<AIProvider, string> = {
  claude: 'claude-sonnet-5',
  openai: 'gpt-5-mini',
  gemini: 'gemini-3.8-flash',
}

async function providerResponse(response: Response, provider: AIProvider): Promise<unknown> {
  if (!response.ok) {
    const reason = response.status === 401 || response.status === 403
      ? 'The API key was rejected.'
      : response.status === 429
        ? 'The API account is rate limited or out of quota.'
        : `The provider returned HTTP ${response.status}.`
    throw new AIConnectionError(`${provider} connection failed. ${reason} Check the key and billing in Settings.`)
  }
  return response.json()
}

export async function generateUserText(provider: AIProvider, apiKey: string, prompt: string, maxOutputTokens = 4000): Promise<string> {
  let text = ''
  try {
    if (provider === 'gemini') {
      const result = await new GoogleGenerativeAI(apiKey).getGenerativeModel({
        model: MODELS.gemini, generationConfig: { maxOutputTokens },
      }).generateContent(prompt)
      text = result.response.text()
    } else if (provider === 'claude') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: AbortSignal.timeout(60000),
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODELS.claude, max_tokens: maxOutputTokens, messages: [{ role: 'user', content: prompt }] }),
      })
      const body = await providerResponse(response, provider) as { content?: { type?: string; text?: string }[] }
      text = body.content?.filter(part => part.type === 'text').map(part => part.text ?? '').join('\n') ?? ''
    } else {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST', signal: AbortSignal.timeout(60000),
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: MODELS.openai, input: prompt, max_output_tokens: maxOutputTokens, store: false }),
      })
      const body = await providerResponse(response, provider) as {
        output?: { content?: { type?: string; text?: string }[] }[]
      }
      text = body.output?.flatMap(item => item.content ?? []).filter(part => part.type === 'output_text').map(part => part.text ?? '').join('\n') ?? ''
    }
  } catch (error) {
    if (error instanceof AIConnectionError) throw error
    console.error(`[AI] ${provider} request failed`)
    throw new AIConnectionError(`${provider} connection failed. Check the connection and billing in Settings.`)
  }
  if (!text.trim()) throw new AIConnectionError(`${provider} returned no text. Check the connection in Settings.`)
  return text
}

export async function testAIConnection(provider: AIProvider, apiKey: string): Promise<void> {
  await generateUserText(provider, apiKey, 'Reply with OK.', 512)
}
