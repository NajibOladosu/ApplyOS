import React, { useState } from 'react'
import { AuthManager } from '../../lib/auth/auth-manager'
import { Loader2, ArrowRight } from 'lucide-react'

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
                    <div className="flex items-center justify-center space-x-2 mb-4">
                        <img src="logo.webp" alt="ApplyOS" className="h-12 w-auto object-contain" />
                        <span className="text-3xl font-bold font-mono">
                            <span className="text-primary">Apply</span>
                            <span className="text-white">OS</span>
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground">Sign in to your account to continue</p>
                </div>

                <div className="card glass-effect">
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold">Sign In</h2>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        {error && (
                            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium">Email</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input-field"
                                placeholder="you@example.com"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="password" className="text-sm font-medium">Password</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input-field"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full btn-primary h-11 text-[#0a0a0a] font-bold"
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
                </div>

                <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                        Don't have an account? <a href="http://localhost:3000/auth/signup" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline transition-colors">Create one</a>
                    </p>
                </div>
            </div>
        </div>
    )
}
