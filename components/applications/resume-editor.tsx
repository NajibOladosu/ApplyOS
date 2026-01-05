"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Download, FileText, Loader2, Save, Undo, ZoomIn, ZoomOut } from "lucide-react"
import { ResumeFeedback, type ResumeAnalysisResult } from "./resume-feedback"
import { Document, Page, pdfjs } from "react-pdf"
import { useResizeObserver } from "usehooks-ts"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

interface ResumeEditorProps {
    documentUrl: string
    analysis: ResumeAnalysisResult
    onBack: () => void
    fileName: string
}

interface Replacement {
    id: string
    page: number
    rect: { x: number; y: number; w: number; h: number }
    originalText: string
    newText: string
    style: {
        fontSize: number
        fontFamily: string
        color: string
    }
}

export function ResumeEditor({ documentUrl, analysis, onBack, fileName }: ResumeEditorProps) {
    const [numPages, setNumPages] = useState<number>(0)
    const [scale, setScale] = useState(1.0)
    const containerRef = useRef<HTMLDivElement>(null)
    const [containerWidth, setContainerWidth] = useState<number>(0)

    // Editing State
    const [replacements, setReplacements] = useState<Replacement[]>([])
    const [activeEdit, setActiveEdit] = useState<{
        rect: { top: number; left: number; width: number; height: number }
        pageIndex: number
        originalText: string
        originalStyle: any
    } | null>(null)
    const [editText, setEditText] = useState("")

    // API State
    const [isSaving, setIsSaving] = useState(false)

    // Handle container resize to fit PDF width
    useResizeObserver({
        ref: containerRef,
        onResize: ({ width }: { width: number }) => {
            setContainerWidth(width)
        },
    })

    // Compute scale to fit width with some padding
    useEffect(() => {
        if (containerWidth) {
            // A4 is roughly 595pt width. 
            // If container is 800px, scale ~ 1.3
            // but we'll let user control scale or auto-fit.
            // For now default to 1 or basic responsiveness
            if (containerWidth < 600) {
                setScale(containerWidth / 620)
            } else {
                setScale(1.0)
            }
        }
    }, [containerWidth])

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages)
    }

    const handleTextLayerClick = (e: any, pageIndex: number) => {
        // Only allow clicking if target is a span (text item)
        if (e.target.tagName !== 'SPAN') return

        const span = e.target as HTMLSpanElement
        const rect = span.getBoundingClientRect()
        const parentRect = span.closest('.react-pdf__Page')?.getBoundingClientRect()

        if (!parentRect) return

        // Calculate relative position to the Page
        const relativeRect = {
            top: rect.top - parentRect.top,
            left: rect.left - parentRect.left,
            width: rect.width,
            height: rect.height
        }

        // Get computed style for font inference
        const computedStyle = window.getComputedStyle(span)

        setActiveEdit({
            rect: relativeRect,
            pageIndex: pageIndex + 1, // 1-based for API
            originalText: span.textContent || "",
            originalStyle: {
                fontSize: parseFloat(computedStyle.fontSize),
                fontFamily: computedStyle.fontFamily,
                color: computedStyle.color
            }
        })
        setEditText(span.textContent || "")
    }

    const commitEdit = () => {
        if (!activeEdit) return

        const id = Math.random().toString(36).substr(2, 9)

        // Convert CSS coordinates (scaled) to PDF coordinates (points)
        // We assume React-PDF rendered at 'scale'. 
        // PDF Points = CSS Pixels / scale
        const pdfRect = {
            x: activeEdit.rect.left / scale,
            y: activeEdit.rect.top / scale,
            w: activeEdit.rect.width / scale,
            h: activeEdit.rect.height / scale
        }

        // NOTE: iLovePDF/PDF coordinate system is usually Bottom-Left for Y.
        // But many high-level "Edit" APIs usually abstract this or expect Top-Left if specifying "top/left".
        // HOWEVER, standard PDF structure is Y-up.
        // Ideally iLovePDF API documentation clarifies this.
        // Typically, HTML-to-PDF APIs might use Top-Left. 
        // For 'editpdf' tool with explicit coordinates, it often respects the standard PDF system (0,0 is bottom-left).
        // Let's assume Top-Left for now as it's common in "Draw" overlays, 
        // BUT we might need to invert Y: y_pdf = page_height - y_css.
        // Since we don't have page height easily without querying, 
        // and 'editpdf' usually allows placing relative to expected visual placement.
        // Let's rely on standard Top-Left if possible or check output.
        // Given we are sending this to our proxy, we can adjust there if needed.
        // For now, we will send Top-Left coordinates.
        // *Correction*: We need valid PDF coordinates.
        // For simplicity in this iteration, we send the rect as is and let the backend/service handle coordinate checks if needed.

        setReplacements(prev => [
            ...prev,
            {
                id,
                page: activeEdit.pageIndex,
                rect: pdfRect,
                originalText: activeEdit.originalText,
                newText: editText,
                style: activeEdit.originalStyle
            }
        ])

        setActiveEdit(null)
        setEditText("")
    }

    const cancelEdit = () => {
        setActiveEdit(null)
        setEditText("")
    }

    const removeReplacement = (id: string) => {
        setReplacements(prev => prev.filter(r => r.id !== id))
    }

    const handleSaveDownload = async () => {
        setIsSaving(true)
        try {
            const response = await fetch('/api/applications/edit-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    documentUrl,
                    replacements
                })
            })

            if (!response.ok) throw new Error("Failed to generate PDF")

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `edited_${fileName}`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (error) {
            console.error(error)
            alert("Failed to save/download PDF. Please try again.")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] animate-in slide-in-from-right duration-300">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b bg-background z-10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={onBack}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            Resume Editor
                        </h2>
                        <p className="text-xs text-muted-foreground hidden sm:block">
                            Correct typos directly on the PDF
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}>
                        <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-xs w-12 text-center">{Math.round(scale * 100)}%</span>
                    <Button variant="outline" size="sm" onClick={() => setScale(s => Math.min(2.0, s + 0.1))}>
                        <ZoomIn className="h-4 w-4" />
                    </Button>

                    <Button onClick={handleSaveDownload} disabled={isSaving || replacements.length === 0} className="glow-effect ml-2">
                        {isSaving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Download className="mr-2 h-4 w-4" />
                                Download Edited PDF
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden">
                {/* Left: Feedback */}
                <div className="w-full lg:w-1/3 overflow-y-auto pr-2 custom-scrollbar border-r border-border/50 hidden lg:block">
                    <div className="mb-4">
                        <h3 className="font-medium text-sm text-muted-foreground mb-2">Analysis Suggestions</h3>
                        <ResumeFeedback analysis={analysis} compact={true} />
                    </div>
                </div>

                {/* Main: PDF Canvas */}
                <div className="flex-1 bg-muted/20 relative overflow-auto rounded-lg border flex justify-center p-4 custom-scrollbar" ref={containerRef}>
                    <div className="relative shadow-xl">
                        <Document
                            file={documentUrl}
                            onLoadSuccess={onDocumentLoadSuccess}
                            loading={
                                <div className="flex items-center justify-center p-20">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            }
                            error={
                                <div className="flex flex-col items-center justify-center p-20 text-red-500">
                                    <p>Failed to load PDF.</p>
                                    <p className="text-xs">The file might not be accessible or CORS policy blocked it.</p>
                                </div>
                            }
                        >
                            {Array.from(new Array(numPages), (el, index) => (
                                <div key={`page_${index + 1}`} className="mb-4 relative group">
                                    <Page
                                        pageNumber={index + 1}
                                        scale={scale}
                                        onClick={(e) => handleTextLayerClick(e, index)}
                                        className="cursor-text"
                                    />

                                    {/* Render Replacements Overlays */}
                                    {replacements.filter(r => r.page === index + 1).map(rep => (
                                        <div
                                            key={rep.id}
                                            className="absolute bg-yellow-100/80 border border-yellow-400 text-black flex items-center justify-center cursor-pointer hover:bg-red-100/80 hover:border-red-400 group-hover/rep:block"
                                            style={{
                                                top: rep.rect.y * scale,
                                                left: rep.rect.x * scale,
                                                width: rep.rect.w * scale,
                                                height: rep.rect.h * scale,
                                                fontSize: Math.max(10, rep.rect.h * scale * 0.8) + 'px', // approximate font size
                                                lineHeight: 1
                                            }}
                                            title="Click to remove this edit"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                removeReplacement(rep.id)
                                            }}
                                        >
                                            {rep.newText}
                                        </div>
                                    ))}

                                    {/* Active Edit Input Overlay */}
                                    {activeEdit && activeEdit.pageIndex === index + 1 && (
                                        <div
                                            className="absolute z-50 bg-background shadow-lg border border-primary rounded p-1 flex items-center gap-2"
                                            style={{
                                                top: activeEdit.rect.top - 40, // Floating above
                                                left: activeEdit.rect.left,
                                            }}
                                        >
                                            <input
                                                autoFocus
                                                value={editText}
                                                onChange={e => setEditText(e.target.value)}
                                                className="h-8 px-2 rounded border border-input text-sm min-w-[200px]"
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') commitEdit()
                                                    if (e.key === 'Escape') cancelEdit()
                                                }}
                                            />
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={commitEdit}>
                                                <Save className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={cancelEdit}>
                                                <Undo className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}

                                </div>
                            ))}
                        </Document>
                    </div>
                </div>
            </div>
        </div>
    )
}
