"use client"

import { cn } from "@/lib/utils"

interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
  className?: string
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  className,
}: ToggleSwitchProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {label && (
        <label className="text-sm font-medium text-foreground/80">
          {label}
        </label>
      )}
      <button
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={cn(
          "relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-200 ease-in-out",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          checked
            ? "bg-primary/20 border-2 border-primary"
            : "bg-muted border-2 border-muted-foreground/30"
        )}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-gradient-to-br transition-all duration-200",
            checked
              ? "translate-x-6 from-primary to-primary/80 shadow-lg shadow-primary/50"
              : "translate-x-1 from-muted-foreground/50 to-muted-foreground/30"
          )}
        />
      </button>
    </div>
  )
}
