"use client"

import * as React from "react"

export type ToastVariant = "default" | "destructive"

export interface ToastOptions {
  id?: string
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

interface ToastInstance extends ToastOptions {
  id: string
}

interface ToastContextValue {
  toasts: ToastInstance[]
  addToast: (options: ToastOptions) => void
  removeToast: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | undefined>(
  undefined
)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastInstance[]>([])

  const removeToast = React.useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const addToast = React.useCallback((options: ToastOptions) => {
    const id =
      options.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const toast: ToastInstance = {
      id,
      title: options.title,
      description: options.description,
      variant: options.variant ?? "default",
      duration: options.duration ?? 4000,
    }

    setToasts((current) => [...current, toast])

    if (toast.duration && toast.duration > 0) {
      window.setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id))
      }, toast.duration)
    }
  }, [])

  const contextValue = React.useMemo<ToastContextValue>(
    () => ({ toasts, addToast, removeToast }),
    [toasts, addToast, removeToast]
  )

  return React.createElement(
    ToastContext.Provider,
    { value: contextValue },
    children
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error(
      "useToast must be used within <ToastProvider> mounted near the root layout."
    )
  }

  return {
    toast: context.addToast,
    dismiss: context.removeToast,
    toasts: context.toasts,
  }
}