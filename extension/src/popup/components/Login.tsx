import React, { useState } from 'react'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { AuthManager } from '../../lib/auth/auth-manager'
import { Card, ErrorNote, Spinner } from './ui'

interface LoginProps {
    onLoginSuccess: () => void
}

const SIGNUP_URL = 'https://www.applyos.io/auth/signup'

export function Login({ onLoginSuccess }: LoginProps) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleLogin = async (event: React.FormEvent) => {
        event.preventDefault()
        setIsLoading(true)
        setError(null)

        try {
            await AuthManager.signIn(email, password)
            onLoginSuccess()
        } catch (err: any) {
            console.error('[ApplyOS] login failed', err)
            setError(err?.message || 'Could not sign in. Check your details and try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex h-full flex-col items-center justify-center bg-background px-6">
            <div className="w-full max-w-[300px]">
                {/* Lockup */}
                <div className="mb-6 text-center">
                    <img src="icons/icon-128.png" alt="" className="mx-auto mb-3 h-12 w-12 rounded-xl" />
                    <h1 className="font-display text-xl font-bold tracking-[-0.02em]">
                        <span className="text-primary">Apply</span>OS
                    </h1>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        Sign in to save jobs and sync your applications.
                    </p>
                </div>

                <Card className="p-4">
                    <form onSubmit={handleLogin} className="space-y-3">
                        {error ? <ErrorNote>{error}</ErrorNote> : null}

                        <div className="space-y-1.5">
                            <label htmlFor="email" className="overline block">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                autoComplete="username"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                className="input-field"
                                placeholder="you@example.com"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="password" className="overline block">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                className="input-field"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !email || !password}
                            className="btn-primary h-10 w-full"
                        >
                            {isLoading ? (
                                <Spinner className="h-4 w-4" />
                            ) : (
                                <>
                                    Sign in
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </>
                            )}
                        </button>
                    </form>
                </Card>

                <p className="mt-4 text-center text-[11px] text-muted-foreground">
                    No account?{' '}
                    <a
                        href={SIGNUP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 font-medium text-primary-strong hover:underline dark:text-primary"
                    >
                        Create one
                        <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                </p>
            </div>
        </div>
    )
}
