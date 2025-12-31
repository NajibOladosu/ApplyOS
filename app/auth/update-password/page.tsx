"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

export default function UpdatePasswordPage() {
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        // We use onAuthStateChange to detect when the session is established,
        // which handles both PKCE (code exchange) and Implicit (hash parsing)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log("🔐 Auth state change:", event, session ? "Session exists" : "No session")

            if (event === "PASSWORD_RECOVERY" || session) {
                // Clear any "invalid link" error if we have a session or recovery event
                setError("")
            }
        })

        const checkAuth = async () => {
            // Give the Supabase client a moment to parse the hash if it's an implicit flow
            // Sometimes it's not ready immediately on mount
            const { data: { session: initialSession } } = await supabase.auth.getSession()

            if (initialSession) {
                return
            }

            // If no session, check for code (PKCE)
            const url = new URL(window.location.href)
            const code = url.searchParams.get('code')

            // Check for access_token in hash (Implicit Flow) - 
            // Supabase client handles this, but we can check it to avoid showing the error too soon
            const hasHash = window.location.hash && window.location.hash.includes('access_token=')

            if (code) {
                const { error } = await supabase.auth.exchangeCodeForSession(code)
                if (error) {
                    setError("The recovery link has expired or is invalid.")
                }
            } else if (!hasHash) {
                // No session, no code, and NO hash? They shouldn't be here.
                // We show the error, but we'll re-verify if a session appears later
                setError("You must use a valid recovery link to access this page.")
            }
        }

        checkAuth()

        return () => {
            subscription.unsubscribe()
        }
    }, [supabase.auth])

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()

        if (password !== confirmPassword) {
            setError("Passwords do not match")
            return
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters")
            return
        }

        setLoading(true)
        setError("")

        const { error } = await supabase.auth.updateUser({
            password: password,
        })

        if (error) {
            setError(error.message)
        } else {
            setSuccess(true)
            // Redirect to dashboard after a delay
            setTimeout(() => {
                router.push("/dashboard")
            }, 2000)
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md"
            >
                <div className="text-center mb-8">
                    <Link href="/" className="inline-block">
                        <div className="flex items-center justify-center space-x-2 mb-4">
                            <img src="/logo.svg" alt="ApplyOS" className="h-12 w-auto" />
                            <span className="text-3xl font-bold font-mono">
                                <span className="text-primary">Apply</span>
                                <span className="text-white">OS</span>
                            </span>
                        </div>
                    </Link>
                    <h1 className="text-2xl font-bold text-foreground">Update password</h1>
                    <p className="text-muted-foreground">Set a new password for your account</p>
                </div>

                <Card className="glass-effect">
                    <CardHeader>
                        <CardTitle>New Password</CardTitle>
                        <CardDescription>
                            Please enter your new password below.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {success ? (
                            <div className="space-y-4">
                                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm">
                                    <p className="font-medium mb-1">Success!</p>
                                    <p>Your password has been updated. Redirecting you to the dashboard...</p>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleUpdatePassword} className="space-y-4">
                                {error && (
                                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label htmlFor="password" className="text-sm font-medium">
                                        New Password
                                    </label>
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="confirmPassword" className="text-sm font-medium">
                                        Confirm New Password
                                    </label>
                                    <Input
                                        id="confirmPassword"
                                        type="password"
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                    />
                                </div>

                                <Button type="submit" className="w-full bg-primary text-[#0a0a0a] font-bold hover:bg-primary/90" disabled={loading}>
                                    {loading ? "Updating password..." : "Update Password"}
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    )
}
