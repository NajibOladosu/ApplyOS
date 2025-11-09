"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"
import { AlertCircle, CheckCircle, Info } from "lucide-react"

interface AlertModalProps {
  isOpen: boolean
  title: string
  message: string
  type?: "error" | "success" | "info"
  onClose: () => void
  closeText?: string
}

export function AlertModal({
  isOpen,
  title,
  message,
  type = "info",
  onClose,
  closeText = "Close",
}: AlertModalProps) {
  if (!isOpen) return null

  const getIcon = () => {
    switch (type) {
      case "error":
        return <AlertCircle className="h-5 w-5 text-destructive" />
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "info":
      default:
        return <Info className="h-5 w-5 text-primary" />
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-sm"
        >
          <Card>
            <CardHeader className="flex flex-row items-start space-x-3 space-y-0">
              <div className="mt-1">{getIcon()}</div>
              <div className="flex-1">
                <CardTitle className="text-lg">{title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CardDescription className="text-sm text-foreground">
                {message}
              </CardDescription>
              <Button onClick={onClose} className="w-full">
                {closeText}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
