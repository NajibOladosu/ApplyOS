'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import styles from './ai-connections.module.css'

type Provider = 'claude' | 'openai' | 'gemini'
type Settings = {
  textSource: 'applyos' | Provider
  audioSource: 'applyos' | 'openai' | 'gemini'
  connections: { provider: Provider; testedAt: string }[]
}

const providers: { id: Provider; label: string }[] = [
  { id: 'claude', label: 'Claude API' },
  { id: 'openai', label: 'OpenAI API' },
  { id: 'gemini', label: 'Gemini API' },
]

export function AIConnectionsSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [keys, setKeys] = useState<Record<Provider, string>>({ claude: '', openai: '', gemini: '' })
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  useEffect(() => {
    fetch('/api/ai/connections', { cache: 'no-store' })
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error)
        setSettings(body)
      })
      .catch(() => setMessage({ text: 'Could not load AI connections. Refresh this page to try again.', error: true }))
  }, [])

  async function mutate(path: string, method: string, body: Record<string, unknown>, label: string) {
    setBusy(label)
    setMessage(null)
    try {
      const response = await fetch(path, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'The request failed.')
      if (result.textSource) setSettings(result as Settings)
      if (method === 'POST' && path === '/api/ai/connections') {
        setKeys(previous => ({ ...previous, [body.provider as Provider]: '' }))
      }
      setMessage({ text: `${label} succeeded.`, error: false })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : `${label} failed.`, error: true })
    } finally {
      setBusy(null)
    }
  }

  const textConnected = settings?.textSource === 'applyos' || settings?.connections.some(connection => connection.provider === settings?.textSource)
  const audioConnected = settings?.audioSource === 'applyos' || settings?.connections.some(connection => connection.provider === settings?.audioSource)

  return (
    <section className={styles.panel} aria-labelledby="ai-connections-title">
      <div className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>AI routing / Your account</p>
          <h2 className={styles.title} id="ai-connections-title">Choose who powers your work.</h2>
          <p className={styles.intro}>Use ApplyOS Gemini or connect your own provider API account. Text and voice can have different sources.</p>
        </div>
        <div className={styles.routeMark} aria-hidden="true">ApplyOS <span /> Your source</div>
      </div>

      <div className={styles.body}>
        <div className={styles.sources}>
          <div className={styles.field}>
            <label htmlFor="ai-text-source">Text, documents and writing</label>
            <select id="ai-text-source" value={settings?.textSource ?? 'applyos'} disabled={!settings || !!busy}
              onChange={event => void mutate('/api/ai/connections/select', 'PATCH', { kind: 'text', source: event.target.value }, 'Text source update')}>
              <option value="applyos">ApplyOS Gemini</option>
              {providers.map(provider => <option key={provider.id} value={provider.id} disabled={!settings?.connections.some(connection => connection.provider === provider.id) || (provider.id === 'claude' && settings?.audioSource === 'applyos')}>{provider.label}</option>)}
            </select>
            <p className={styles.status}>Claude text requires your own Gemini or OpenAI voice source.</p>
            {settings && !textConnected ? <p role="alert" className={styles.status}>Selected connection is missing. Reconnect it to resume text AI.</p> : null}
          </div>
          <div className={styles.field}>
            <label htmlFor="ai-audio-source">Voice and transcription</label>
            <select id="ai-audio-source" value={settings?.audioSource ?? 'applyos'} disabled={!settings || !!busy}
              onChange={event => void mutate('/api/ai/connections/select', 'PATCH', { kind: 'audio', source: event.target.value }, 'Audio source update')}>
              <option value="applyos">ApplyOS Gemini</option>
              {providers.filter(provider => provider.id !== 'claude').map(provider => <option key={provider.id} value={provider.id} disabled={!settings?.connections.some(connection => connection.provider === provider.id)}>{provider.label}</option>)}
            </select>
            {settings && !audioConnected ? <p role="alert" className={styles.status}>Selected connection is missing. Reconnect it to resume voice AI.</p> : null}
          </div>
          <p className={styles.payer}><strong>Who pays</strong>{settings ? <>{settings.textSource === 'applyos' ? 'ApplyOS pays for text AI.' : `Your ${settings.textSource} API account pays for text AI.`} {settings.audioSource === 'applyos' ? 'ApplyOS pays for voice AI.' : `Your ${settings.audioSource} API account pays for voice AI.`} API use may incur provider charges; consumer subscriptions do not cover this connection.</> : 'Source details are unavailable until connections load.'}</p>
        </div>

        <div className={styles.connections}>
          <h3>Connections</h3>
          {providers.map(provider => {
            const connected = settings?.connections.find(connection => connection.provider === provider.id)
            return <div className={styles.provider} key={provider.id}>
              <div className={styles.providerHead}><span className={styles.providerName}>{provider.label}</span><span className={styles.status}>{connected ? 'Connected · API key saved' : 'Not connected'}</span></div>
              <div className={styles.keyRow}>
                <input className={styles.keyInput} type="password" autoComplete="off" aria-label={`${provider.label} API key`} placeholder={connected ? 'Replace API key' : 'Paste API key'} value={keys[provider.id]}
                  onChange={event => setKeys(previous => ({ ...previous, [provider.id]: event.target.value }))} />
                <button className={styles.action} disabled={!settings || !!busy || !keys[provider.id].trim()} onClick={() => void mutate('/api/ai/connections', 'POST', { provider: provider.id, apiKey: keys[provider.id] }, `${provider.label} connection`)}>Connect</button>
              </div>
              {connected ? <div>
                <button className={styles.providerAction} disabled={!!busy} onClick={() => void mutate('/api/ai/connections/test', 'POST', { provider: provider.id }, `${provider.label} test`)}>Test connection</button>
                <button className={styles.providerAction} disabled={!!busy} onClick={() => void mutate('/api/ai/connections', 'DELETE', { provider: provider.id }, `${provider.label} disconnect`)}>Disconnect</button>
              </div> : null}
            </div>
          })}
        </div>
      </div>
      <div className={styles.foot}>
        {message ? <p className={`${styles.message} ${message.error ? styles.error : styles.success}`} role="status">{message.text}</p> : null}
        <p>Your ApplyOS activity will not appear in your provider’s chat history. ApplyOS saves the results needed for your applications and interviews; the provider may retain API data under its policies.</p>
        <p>Manage your saved applications and interviews in ApplyOS. <Link href="/profile">Account deletion controls</Link> are in Profile.</p>
      </div>
    </section>
  )
}
