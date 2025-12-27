import React from "react"
import { cn } from "@/lib/utils"

interface LogoProps {
    className?: string
    iconOnly?: boolean
    variant?: "default" | "landing"
}

export function Logo({ className, iconOnly = false, variant = "default" }: LogoProps) {
    if (iconOnly) {
        return (
            <div className={cn("relative flex h-8 w-8 items-center justify-center", className)}>
                <span className="text-2xl font-bold text-primary italic" style={{ fontFamily: "var(--font-crimson)" }}>A</span>
            </div>
        )
    }

    return (
        <div className={cn("flex items-center group select-none", className)}>
            <div className="flex flex-col leading-none">
                <div className="flex items-baseline overflow-hidden">
                    <span
                        className={cn(
                            "font-light italic tracking-[0.15em] transition-all duration-700 ease-out",
                            variant === "landing" ? "text-3xl" : "text-xl",
                            "text-primary group-hover:tracking-[0.25em]"
                        )}
                        style={{ fontFamily: "var(--font-crimson)" }}
                    >
                        Apply
                    </span>
                    <span
                        className={cn(
                            "font-extrabold italic tracking-tighter transition-all duration-500 ease-in-out",
                            variant === "landing" ? "text-3xl" : "text-xl",
                            "text-white group-hover:text-primary group-hover:skew-x-[-12deg]"
                        )}
                    >
                        OS
                    </span>
                </div>
                {variant === "landing" && (
                    <div className="h-[1px] w-0 bg-primary/30 transition-all duration-1000 group-hover:w-full mt-1" />
                )}
            </div>
        </div>
    )
}
