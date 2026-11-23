'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'

type Provider = 'claude' | 'openai' | 'gemini'
type Settings = {
  textSource: 'applyos' | Provider
  audioSource: 'applyos' | 'openai' | 'gemini'
  connections: { provider: Provider; testedAt: string }[]
}

const providers: { id: Provider; label: string; help: string }[] = [
  { id: 'claude', label: 'Claude', help: 'Max and Team members can claim monthly API credits for a linked Claude Console organization.' },
  { id: 'openai', label: 'OpenAI', help: 'This key uses OpenAI API billing, separate from your ChatGPT plan.' },
  { id: 'gemini', label: 'Gemini', help: 'This uses Gemini API billing, separate from a Gemini app subscription.' },
]

const selectClass = 'h-9 rounded-lg border border-border/80 bg-card px-3 text-[13px] text-foreground'

export function AIConnectionsSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [keys, setKeys] = useState<Record<Provider, string>>({ claude: '', openai: '', gemini: '' })
  const [editing, setEditing] = useState<Provider | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  useEffect(() => {
    let active = true
    setLoadError(null)
    fetch('/api/ai/connections', { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error || 'Could not load API connections. Please try again.')
        if (active) setSettings(body)
      })
      .catch(error => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Could not load API connections. Please try again.')
      })
    return () => { active = false }
  }, [reloadCount])

  async function mutate(path: string, method: string, body: Record<string, unknown>, success: string): Promise<boolean> {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch(path, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'The request failed.')
      if (result.textSource) setSettings(result as Settings)
      setMessage({ text: success, error: false })
      return true
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'The request failed.', error: true })
      return false
    } finally {
      setBusy(false)
    }
  }

  async function connect(provider: Provider) {
    if (!keys[provider].trim()) return
    const saved = await mutate('/api/ai/connections', 'POST', { provider, apiKey: keys[provider] }, `${provider} connected.`)
    if (saved) {
      setKeys(previous => ({ ...previous, [provider]: '' }))
      setEditing(null)
    }
  }

  const connected = (provider: Provider) => settings?.connections.some(connection => connection.provider === provider)
  const textMissing = settings && settings.textSource !== 'applyos' && !connected(settings.textSource)
  const audioMissing = settings && settings.audioSource !== 'applyos' && !connected(settings.audioSource)

  return (
    <div className="divide-y divide-border/50">
      {loadError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-xs text-destructive">
        <span>{loadError}</span>
        <Button variant="outline" size="sm" onClick={() => setReloadCount(count => count + 1)}>Retry</Button>
      </div> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div>
          <label htmlFor="ai-text-source" className="text-[13.5px] font-medium text-foreground">Text source</label>
          <p className="mt-0.5 text-xs text-muted-foreground">Documents, writing and questions</p>
          {textMissing ? <p role="alert" className="mt-1 text-xs text-destructive">Selected connection is missing. Reconnect it or choose another source.</p> : null}
        </div>
        <select id="ai-text-source" className={selectClass} value={settings?.textSource ?? 'applyos'} disabled={!settings || busy}
          onChange={event => void mutate('/api/ai/connections/select', 'PATCH', { kind: 'text', source: event.target.value }, 'Text source updated.')}>
          <option value="applyos">ApplyOS Gemini</option>
          {providers.map(provider => <option key={provider.id} value={provider.id} disabled={!connected(provider.id) || (provider.id === 'claude' && settings?.audioSource === 'applyos')}>{provider.label} API</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div>
          <label htmlFor="ai-audio-source" className="text-[13.5px] font-medium text-foreground">Voice source</label>
          <p className="mt-0.5 text-xs text-muted-foreground">Interviews and transcription. Claude text needs your own Gemini or OpenAI voice source.</p>
          {audioMissing ? <p role="alert" className="mt-1 text-xs text-destructive">Selected connection is missing. Reconnect it or choose another source.</p> : null}
        </div>
        <select id="ai-audio-source" className={selectClass} value={settings?.audioSource ?? 'applyos'} disabled={!settings || busy}
          onChange={event => void mutate('/api/ai/connections/select', 'PATCH', { kind: 'audio', source: event.target.value }, 'Voice source updated.')}>
          <option value="applyos">ApplyOS Gemini</option>
          {providers.filter(provider => provider.id !== 'claude').map(provider => <option key={provider.id} value={provider.id} disabled={!connected(provider.id)}>{provider.label} API</option>)}
        </select>
      </div>

      {providers.map(provider => {
        const isConnected = connected(provider.id)
        return <div key={provider.id} className="px-5 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13.5px] font-medium text-foreground">{provider.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isConnected ? 'Connected · API key saved' : 'Not connected'}
                {provider.id === 'claude' ? ' · Max/Team API credits eligible' : ''}
              </p>
            </div>
            <Button variant="outline" size="sm" disabled={!settings || busy}
              onClick={() => setEditing(current => current === provider.id ? null : provider.id)}>
              {isConnected ? 'Manage' : 'Connect'}
            </Button>
          </div>
          {editing === provider.id ? <div className="mt-3 space-y-2 rounded-lg bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">{provider.help}</p>
            {provider.id === 'claude' ? <a className="inline-block text-xs text-primary-strong underline underline-offset-2" href="https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-and-team-plans" target="_blank" rel="noopener noreferrer">How to claim Claude API credits</a> : null}
            <div className="flex flex-wrap gap-2">
              <Input type="password" autoComplete="off" aria-label={`${provider.label} API key`}
                placeholder={isConnected ? 'Replace API key' : 'Paste API key'} value={keys[provider.id]}
                onChange={event => setKeys(previous => ({ ...previous, [provider.id]: event.target.value }))}
                className="h-9 min-w-48 flex-1 text-[13px]" />
              <Button size="sm" disabled={busy || !keys[provider.id].trim()} onClick={() => void connect(provider.id)}>Save key</Button>
            </div>
            {isConnected ? <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={busy}
                onClick={() => void mutate('/api/ai/connections/test', 'POST', { provider: provider.id }, `${provider.label} connection works.`)}>Test</Button>
              <Button variant="outline" size="sm" disabled={busy}
                onClick={() => void mutate('/api/ai/connections', 'DELETE', { provider: provider.id }, `${provider.label} disconnected.`)}>Disconnect</Button>
            </div> : null}
          </div> : null}
        </div>
      })}

      <div className="space-y-2 px-5 py-3.5 text-xs leading-relaxed text-muted-foreground">
        {message ? <p role="status" className={message.error ? 'text-destructive' : 'text-primary-strong'}>{message.text}</p> : null}
        <p><span className="font-medium text-foreground">Who pays:</span> {settings
          ? `${settings.textSource === 'applyos' ? 'ApplyOS pays for text AI' : `Your ${settings.textSource} API account pays for text AI`}; ${settings.audioSource === 'applyos' ? 'ApplyOS pays for voice AI' : `your ${settings.audioSource} API account pays for voice AI`}.`
          : 'Source details will appear when connections load.'} Claude Max and Team API credits may cover eligible Claude API use when claimed and linked in Claude Console.</p>
        <p>Your ApplyOS activity will not appear in your provider’s chat history. ApplyOS saves the results needed for your applications and interviews; the provider may retain API data under its policies.</p>
        <p><Link href="/profile" className="underline underline-offset-2">Account deletion controls</Link> are in Profile.</p>
      </div>
    </div>
  )
}
