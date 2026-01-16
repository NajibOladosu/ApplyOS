"use client"

import { useState, useEffect } from "react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"

interface PromptModalProps {
  isOpen: boolean
  title: string
  description: string
  placeholder?: string
  requiredValue?: string
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive"
  onConfirm: (value: string) => void | Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function PromptModal({
  isOpen,
  title,
  description,
  placeholder = "",
  requiredValue = "",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
  isLoading = false,
}: PromptModalProps) {
  const [value, setValue] = useState("")

  useEffect(() => {
    if (isOpen) {
      setValue("")
    }
  }, [isOpen])

  const isValid = !requiredValue || value === requiredValue

  if (!isOpen) return null

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
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onCancel}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder={placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={isLoading}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && isValid) {
                    onConfirm(value)
                  }
                }}
              />
              {requiredValue && (
                <p className="text-xs text-muted-foreground">
                  Type <span className="font-mono font-semibold">{requiredValue}</span> to confirm
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {cancelText}
                </Button>
                <Button
                  variant={variant === "destructive" ? "destructive" : "default"}
                  onClick={() => onConfirm(value)}
                  disabled={!isValid || isLoading}
                  className={variant === "default" ? "flex-1 glow-effect" : "flex-1"}
                >
                  {confirmText}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
