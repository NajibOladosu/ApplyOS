"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle } from "lucide-react"

export default function VerifiedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <Card className="glass-effect text-center">
          <CardHeader className="pb-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="flex justify-center mb-4"
            >
              <CheckCircle className="h-12 w-12 text-primary" />
            </motion.div>
            <CardTitle className="text-primary">Email Verified!</CardTitle>
            <CardDescription>
              Your email has been verified successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You're all set! You can now log in with your email and password to access your Trackly account.
            </p>
            <div className="p-3 bg-muted rounded-lg border border-border">
              <p className="text-xs text-muted-foreground">
                Welcome to Trackly! Start managing your applications and documents with AI-powered insights.
              </p>
            </div>
            <Button asChild className="w-full">
              <Link href="/auth/login">Log In to Your Account</Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
