"use client"

import { useState } from "react"
import { Settings2 } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/shared/ui/dialog"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { Button } from "@/shared/ui/button"
import { DEFAULT_DOC_SETTINGS, type DocSettings } from "./types"

interface PageSetupDialogProps {
    settings: DocSettings
    onChange: (next: Partial<DocSettings>) => void
}

const PRESETS: { label: string; value: number }[] = [
    { label: 'Narrow', value: 12 },
    { label: 'Normal', value: 20 },
    { label: 'Wide', value: 28 },
]

export function PageSetupDialog({ settings, onChange }: PageSetupDialogProps) {
    const [open, setOpen] = useState(false)

    const applyAll = (mm: number) => {
        onChange({
            marginTopMm: mm,
            marginRightMm: mm,
            marginBottomMm: mm,
            marginLeftMm: mm,
        })
    }

    const reset = () => onChange(DEFAULT_DOC_SETTINGS)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-2 sm:px-3 font-medium bg-muted/40 border-primary/40 text-foreground hover:bg-primary/10 hover:border-primary hover:text-primary"
                    title="Page setup (margins)"
                >
                    <Settings2 className="h-3.5 w-3.5 lg:mr-1.5" />
                    <span className="hidden lg:inline">Page Setup</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Page setup</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 pt-2">
                    <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Presets</Label>
                        <div className="flex gap-2">
                            {PRESETS.map(p => (
                                <Button
                                    key={p.label}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => applyAll(p.value)}
                                    className="flex-1"
                                >
                                    {p.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Margins (mm)</Label>
                        <div className="grid grid-cols-2 gap-3">
                            <MarginField
                                label="Top"
                                value={settings.marginTopMm}
                                onChange={(v) => onChange({ marginTopMm: v })}
                            />
                            <MarginField
                                label="Bottom"
                                value={settings.marginBottomMm}
                                onChange={(v) => onChange({ marginBottomMm: v })}
                            />
                            <MarginField
                                label="Left"
                                value={settings.marginLeftMm}
                                onChange={(v) => onChange({ marginLeftMm: v })}
                            />
                            <MarginField
                                label="Right"
                                value={settings.marginRightMm}
                                onChange={(v) => onChange({ marginRightMm: v })}
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-border">
                        <Button variant="ghost" size="sm" onClick={reset}>
                            Reset
                        </Button>
                        <Button size="sm" onClick={() => setOpen(false)}>
                            Done
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function MarginField({
    label,
    value,
    onChange,
}: {
    label: string
    value: number
    onChange: (v: number) => void
}) {
    const clamp = (n: number) => Math.max(0, Math.min(50, n))
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <Label className="text-sm">{label}</Label>
                <span className="text-xs text-muted-foreground tabular-nums">{value}mm</span>
            </div>
            <Input
                type="number"
                min={0}
                max={50}
                step={1}
                value={value}
                onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10)
                    if (Number.isFinite(parsed)) onChange(clamp(parsed))
                }}
            />
        </div>
    )
}
