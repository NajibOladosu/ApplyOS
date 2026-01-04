"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowLeft, Download, FileText, Loader2, Save } from "lucide-react"
import { ResumeFeedback, type ResumeAnalysisResult } from "./resume-feedback"
import jsPDF from "jspdf"

interface ResumeEditorProps {
    initialText: string
    analysis: ResumeAnalysisResult
    onBack: () => void
    fileName: string
}

export function ResumeEditor({ initialText, analysis, onBack, fileName }: ResumeEditorProps) {
    const [text, setText] = useState(initialText)
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

    // Update text if initialText changes (though unlikely in this flow)
    useEffect(() => {
        setText(initialText)
    }, [initialText])

    const handleDownloadPdf = () => {
        setIsGeneratingPdf(true)

        // Small timeout to allow UI to update
        setTimeout(() => {
            try {
                const doc = new jsPDF()

                // Set font
                doc.setFont("helvetica")
                doc.setFontSize(12)

                // Split text into lines that fit the page width
                // Page width is usually 210mm (A4), margins say 20mm each side -> 170mm usable
                const splitText = doc.splitTextToSize(text, 170)

                let cursorY = 20
                const pageHeight = 297
                const lineHeight = 7

                // Loop through lines and add pages as needed
                for (let i = 0; i < splitText.length; i++) {
                    if (cursorY + lineHeight > pageHeight - 20) {
                        doc.addPage()
                        cursorY = 20
                    }
                    doc.text(splitText[i], 20, cursorY)
                    cursorY += lineHeight
                }

                // Download
                doc.save(`edited_${fileName.replace(".pdf", "")}.pdf`)
            } catch (err) {
                console.error("Failed to generate PDF:", err)
            } finally {
                setIsGeneratingPdf(false)
            }
        }, 100)
    }

    return (
        <div className="flex flex-col h-[calc(100vh-200px)] min-h-[600px] animate-in slide-in-from-right duration-300">
            {/* Header Toolbar */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={onBack}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Analysis
                    </Button>
                    <div>
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            Resume Editor
                        </h2>
                        <p className="text-xs text-muted-foreground hidden sm:block">
                            Editing: {fileName}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="glow-effect">
                        {isGeneratingPdf ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating PDF...
                            </>
                        ) : (
                            <>
                                <Download className="mr-2 h-4 w-4" />
                                Download PDF
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Split View */}
            <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden">
                {/* Left Sidebar: Feedback */}
                <div className="w-full lg:w-1/3 overflow-y-auto pr-2 custom-scrollbar border-r border-border/50">
                    <div className="mb-4">
                        <h3 className="font-medium text-sm text-muted-foreground mb-2">Analysis Suggestions</h3>
                        <p className="text-xs text-muted-foreground mb-4">
                            Use these insights to improve your resume text on the right.
                        </p>
                        <ResumeFeedback analysis={analysis} compact={true} />
                    </div>
                </div>

                {/* Right Editor Area */}
                <div className="w-full lg:w-2/3 flex flex-col h-full">
                    <Card className="flex-1 flex flex-col overflow-hidden border-primary/20 shadow-lg">
                        <CardHeader className="py-3 px-4 bg-muted/30 border-b">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium">Document Content</CardTitle>
                                <span className="text-xs text-muted-foreground">Markdown / Plain Text</span>
                            </div>
                        </CardHeader>
                        <div className="flex-1 p-0 relative">
                            <Textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                className="w-full h-full resize-none border-0 focus-visible:ring-0 rounded-none p-6 font-mono text-sm leading-relaxed"
                                placeholder="Resume content..."
                                spellCheck={false}
                            />
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    )
}
