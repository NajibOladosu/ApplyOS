"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { AuthOutlineButton, AuthShell, StatusTile } from "@/components/marketing/auth-primitives"

export default function VerifiedPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to login after 3 seconds
    const timer = setTimeout(() => {
      router.push("/auth/login")
    }, 3000)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <AuthShell title="Email verified" subtitle="Your account is confirmed and ready to go.">
      <div className="space-y-6">
        <StatusTile icon={Check} size="lg" />

        <div className="space-y-3 text-center">
          <p className="text-sm leading-relaxed text-muted-foreground">
            You can now sign in and start building your application pipeline.
          </p>
        </div>

        <div className="space-y-3">
          <AuthOutlineButton asChild href="/auth/login">
            Sign in now
          </AuthOutlineButton>

          {/* 3-second auto-redirect progress */}
          <div className="pt-1">
            <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 3, ease: "linear" }}
                className="h-full origin-left rounded-full bg-primary"
              />
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground/70">
              Redirecting you shortly…
            </p>
          </div>
        </div>
      </div>
    </AuthShell>
  )
}
