"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Settings, X, Sun, Moon, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { motion, AnimatePresence } from "framer-motion"

export function BlogSettingsButton() {
    const [isOpen, setIsOpen] = useState(false)
    const [mounted, setMounted] = useState(false)
    const { theme, setTheme } = useTheme()

    // Prevent hydration mismatch
    useEffect(() => {
        setMounted(true)
    }, [])

    const themeOptions = [
        { value: "light", label: "Light", icon: Sun },
        { value: "dark", label: "Dark", icon: Moon },
        { value: "system", label: "System", icon: Monitor },
    ]

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
                        className="absolute bottom-16 right-0 w-56 rounded-xl border border-border bg-background shadow-xl overflow-hidden"
                    >
                        <div className="p-4">
                            <h3 className="text-sm font-semibold text-foreground mb-3">
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
                                                        ? "bg-background text-foreground shadow-sm"
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
                    h-12 w-12 rounded-full shadow-lg flex items-center justify-center transition-colors
                    ${isOpen
                        ? "bg-muted text-foreground"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }
                `}
                aria-label={isOpen ? "Close settings" : "Open settings"}
            >
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
