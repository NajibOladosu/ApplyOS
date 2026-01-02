"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles, Loader2 } from "lucide-react"

interface RegenerateContextModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (extraContext?: string) => Promise<void>
    isRegeneratingAll: boolean
    isLoading?: boolean
}

export function RegenerateContextModal({
    isOpen,
    onClose,
    onConfirm,
    isRegeneratingAll,
    isLoading = false,
}: RegenerateContextModalProps) {
    const [context, setContext] = useState("")

    const handleConfirm = async () => {
        await onConfirm(context.trim() || undefined)
        setContext("") // Reset after confirm
    }

    const handleOpenChange = (open: boolean) => {
        if (!open && !isLoading) {
            onClose()
            setContext("") // Reset on close
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {isRegeneratingAll ? "Generate All Answers" : "Regenerate Answer"}
                    </DialogTitle>
                    <DialogDescription>
                        Would you like to provide any specific instructions for the AI?
                        <br />
                        <span className="text-xs text-muted-foreground mt-1 block">
                            If left empty, the AI will use the default context from your documents.
                        </span>
                    </DialogDescription>
                </DialogHeader>

                <div className="py-2">
                    <Textarea
                        placeholder="E.g., 'Focus more on my leadership experience', 'Keep it under 100 words', 'Make the tone more enthusiastic'..."
                        value={context}
                        onChange={(e) => setContext(e.target.value)}
                        className="min-h-[100px] resize-none"
                        disabled={isLoading}
                    />
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2">
                    <Button
                        variant="ghost"
                        onClick={() => handleOpenChange(false)}
                        disabled={isLoading}
                        className="sm:order-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className="sm:order-2 glow-effect"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                {isRegeneratingAll ? "Generate All" : "Regenerate"}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
