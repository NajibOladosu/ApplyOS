"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Settings, X, Sun, Moon, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { motion, AnimatePresence } from "framer-motion"
import {
    ALL_CONSENT,
    CONSENT_EVENT,
    NO_CONSENT,
    readConsent,
    writeConsent,
    type ConsentState,
} from "@/lib/cookie-consent"

type CookieView = "menu" | "customize"

export function BlogSettingsButton() {
    const [isOpen, setIsOpen] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [cookieView, setCookieView] = useState<CookieView>("menu")
    const [consent, setConsent] = useState<ConsentState | null>(null)
    const [draft, setDraft] = useState<ConsentState>(NO_CONSENT)
    const { theme, setTheme } = useTheme()

    useEffect(() => {
        setMounted(true)
        const initial = readConsent()
        setConsent(initial)
        setDraft(initial ?? NO_CONSENT)

        const handler = (e: Event) => {
            const detail = (e as CustomEvent<ConsentState | null>).detail
            const next = detail ?? readConsent()
            setConsent(next)
            if (next) setDraft(next)
        }
        window.addEventListener(CONSENT_EVENT, handler)
        return () => window.removeEventListener(CONSENT_EVENT, handler)
    }, [])

    const themeOptions = [
        { value: "light", label: "Light", icon: Sun },
        { value: "dark", label: "Dark", icon: Moon },
        { value: "system", label: "System", icon: Monitor },
    ]

    const consentLabel = consent
        ? consent.analytics && consent.performance
            ? "All cookies accepted"
            : !consent.analytics && !consent.performance
                ? "Only essential cookies"
                : "Custom preferences"
        : "No choice yet"

    const handleAcceptAll = () => {
        writeConsent(ALL_CONSENT)
        setCookieView("menu")
    }
    const handleRejectAll = () => {
        writeConsent(NO_CONSENT)
        setCookieView("menu")
    }
    const handleSaveCustom = () => {
        writeConsent(draft)
        setCookieView("menu")
    }

    if (!mounted) {
        return (
            <div className="fixed bottom-6 right-6 z-50">
                <button
                    className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
                    aria-label="Settings"
                >
                    <Settings className="h-5 w-5" />
                </button>
            </div>
        )
    }

    return (
        <div className="fixed bottom-6 right-6 z-50">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute bottom-16 right-0 w-72 rounded-xl border border-border bg-background shadow-xl overflow-hidden"
                    >
                        <div className="p-4 space-y-4">
                            <h3 className="text-sm font-semibold text-foreground">
                                Settings
                            </h3>

                            {/* Theme Section */}
                            <div className="space-y-2">
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                                    Theme
                                </p>
                                <div className="grid grid-cols-3 gap-1 p-1 bg-muted/50 rounded-lg">
                                    {themeOptions.map((option) => {
                                        const Icon = option.icon
                                        const isActive = theme === option.value
                                        return (
                                            <button
                                                key={option.value}
                                                onClick={() => setTheme(option.value)}
                                                className={`
                                                    flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-md text-xs transition-all
                                                    ${isActive
                                                        ? "bg-primary text-primary-foreground shadow-sm"
                                                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                                    }
                                                `}
                                                aria-label={`Set ${option.label} theme`}
                                            >
                                                <Icon className="h-4 w-4" />
                                                <span className="font-medium">{option.label}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Cookies Section */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                                        Cookies
                                    </p>
                                    <span className="text-[10px] text-muted-foreground/80">{consentLabel}</span>
                                </div>

                                {cookieView === "menu" ? (
                                    (() => {
                                        const activeOption: "accept" | "reject" | "custom" | null = consent
                                            ? consent.analytics && consent.performance
                                                ? "accept"
                                                : !consent.analytics && !consent.performance
                                                    ? "reject"
                                                    : "custom"
                                            : null
                                        const optionClass = (active: boolean) =>
                                            `w-full text-left text-sm rounded-md px-3 py-2 hover:bg-muted/50 transition-colors ${active ? "text-primary font-medium" : "text-foreground"}`
                                        return (
                                            <div className="space-y-1">
                                                <button
                                                    type="button"
                                                    onClick={handleAcceptAll}
                                                    className={optionClass(activeOption === "accept")}
                                                >
                                                    Accept all
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleRejectAll}
                                                    className={optionClass(activeOption === "reject")}
                                                >
                                                    Reject non-essential cookies
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setDraft(consent ?? NO_CONSENT)
                                                        setCookieView("customize")
                                                    }}
                                                    className={optionClass(activeOption === "custom")}
                                                >
                                                    Customize preferences <span className="text-muted-foreground font-normal">(recommended)</span>
                                                </button>
                                            </div>
                                        )
                                    })()
                                ) : (
                                    <div className="space-y-3 rounded-md border border-border p-3">
                                        <ConsentRow
                                            label="Essential"
                                            description="Required for sign-in, security, and core features."
                                            checked
                                            disabled
                                        />
                                        <ConsentRow
                                            label="Analytics"
                                            description="Page views and feature usage to improve the product."
                                            checked={draft.analytics}
                                            onChange={(v) => setDraft({ ...draft, analytics: v })}
                                        />
                                        <ConsentRow
                                            label="Performance"
                                            description="Speed Insights to monitor real-user performance."
                                            checked={draft.performance}
                                            onChange={(v) => setDraft({ ...draft, performance: v })}
                                        />
                                        <div className="flex items-center justify-end gap-2 pt-1">
                                            <button
                                                type="button"
                                                onClick={() => setCookieView("menu")}
                                                className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 text-foreground"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSaveCustom}
                                                className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90"
                                            >
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    h-12 w-12 rounded-full shadow-lg flex items-center justify-center transition-colors relative
                    ${isOpen
                        ? "bg-muted text-foreground"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }
                `}
                aria-label={isOpen ? "Close settings" : "Open settings"}
            >
                {!isOpen && consent === null && (
                    <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-amber-500 ring-2 ring-background" aria-hidden="true" />
                )}
                <AnimatePresence mode="wait">
                    {isOpen ? (
                        <motion.div
                            key="close"
                            initial={{ rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: 90, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <X className="h-5 w-5" />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="settings"
                            initial={{ rotate: 90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: -90, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <Settings className="h-5 w-5" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.button>
        </div>
    )
}

function ConsentRow({
    label,
    description,
    checked,
    disabled,
    onChange,
}: {
    label: string
    description: string
    checked: boolean
    disabled?: boolean
    onChange?: (v: boolean) => void
}) {
    return (
        <label className={`flex items-start gap-3 ${disabled ? "opacity-70" : "cursor-pointer"}`}>
            <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border accent-primary disabled:cursor-not-allowed"
                checked={checked}
                disabled={disabled}
                onChange={(e) => onChange?.(e.target.checked)}
            />
            <div className="flex-1">
                <div className="text-xs font-medium text-foreground">{label}</div>
                <div className="text-[11px] text-muted-foreground leading-snug">{description}</div>
            </div>
        </label>
    )
}
