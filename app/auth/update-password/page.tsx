"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card"
import { createClient } from "@/shared/db/supabase/client"

export default function UpdatePasswordPage() {
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                // Since we now use the server-side callback to exchange the code,
                // if there's no session here, something went wrong or the link is invalid.
                setError("Your session has expired or the link is invalid. Please request a new password reset link.")
            }
        }

        checkAuth()
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
            // Redirect to login after a delay
            setTimeout(() => {
                router.push("/auth/login")
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
