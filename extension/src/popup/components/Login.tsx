import React, { useState } from 'react'
import { AuthManager } from '../../lib/auth/auth-manager'
import { LogIn, Loader2, ArrowRight } from 'lucide-react'

interface LoginProps {
    onLoginSuccess: () => void
}

export function Login({ onLoginSuccess }: LoginProps) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)

        try {
            await AuthManager.signIn(email, password)
            onLoginSuccess()
        } catch (err: any) {
            console.error('Login error:', err)
            setError(err.message || 'Failed to login')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex flex-col items-center justify-center p-6 h-full min-h-[500px] bg-background text-foreground">
            <div className="w-full max-w-xs space-y-8">
                <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-primary/20 glow-effect">
                        <span className="text-3xl">🚀</span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Welcome to <span className="text-gradient">ApplyOS</span>
                    </h1>
                    <p className="text-sm text-muted-foreground">Sign in to your account to continue</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-4">
                        <div>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input-field"
                                placeholder="Email address"
                                required
                            />
                        </div>

                        <div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input-field"
                                placeholder="Password"
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="text-xs text-red-500 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full btn-primary h-11"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                Sign In <ArrowRight className="w-4 h-4 ml-2" />
                            </>
                        )}
                    </button>
                </form>

                <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                        Don't have an account? <a href="https://applyos.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-hover hover:underline transition-colors">Create one</a>
                    </p>
                </div>
            </div>
        </div>
    )
}
