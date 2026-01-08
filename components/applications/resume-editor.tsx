"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
    ArrowLeft,
    Download,
    Plus,
    Type,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Bold,
    Italic,
    Underline,
    List,
    Trash2,
    Save,
    History,
    Sparkles,
    Loader2
} from "lucide-react"
import { type ResumeAnalysisResult } from "./resume-feedback"
import { cn } from "@/lib/utils"
import { useDebounceCallback } from "usehooks-ts"
import { resumeVersionsService, type ResumeVersion } from "@/lib/services/resume-versions"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"

// --- Types ---

export type BlockType = 'h1' | 'h2' | 'h3' | 'paragraph' | 'bullet'

export interface BlockStyles {
    bold?: boolean
    italic?: boolean
    underline?: boolean
    align?: 'left' | 'center' | 'right' | 'justify'
}

export interface EditorBlock {
    id: string
    type: BlockType
    content: string
    styles?: BlockStyles
}

interface ResumeEditorProps {
    documentUrl: string
    analysis: ResumeAnalysisResult | null
    parsedData: any
    extractedText: string | null
    applicationId: string
    documentId: string
    onBack: () => void
    fileName: string
}

// --- Constants ---

const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const A4_CONTENT_HEIGHT_MM = 247 // 297 - 50mm (20mm top + 30mm bottom padding for better margin)

// Convert mm to pixels (96 DPI standard)
const MM_TO_PX = 3.7795275591

// --- Initial Data Conversion ---

const createBlock = (type: BlockType, content: string, styles: BlockStyles = {}): EditorBlock => ({
    id: Math.random().toString(36).substr(2, 9),
    type,
    content,
    styles
})

/**
 * Convert extracted text into blocks by intelligently parsing the structure
 */
const getInitialBlocksFromText = (extractedText: string, parsedData: any): EditorBlock[] => {
    const blocks: EditorBlock[] = []
    const lines = extractedText.split('\n').map(l => l.trim()).filter(l => l.length > 0)

    const name = parsedData?.name || lines[0] || "Your Name"
    blocks.push(createBlock('h1', name, { align: 'center', bold: true }))

    const contactLine = lines.find(l => l.includes('@') || l.match(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/))
    if (contactLine) {
        blocks.push(createBlock('paragraph', contactLine, { align: 'center' }))
    }

    let currentSection: 'experience' | 'education' | 'skills' | 'other' | null = null

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        const upperLine = line.toUpperCase()

        if (upperLine.includes('EXPERIENCE') || upperLine.includes('WORK HISTORY')) {
            blocks.push(createBlock('h2', 'Experience', { bold: true }))
            currentSection = 'experience'
            continue
        }
        if (upperLine.includes('EDUCATION')) {
            blocks.push(createBlock('h2', 'Education', { bold: true }))
            currentSection = 'education'
            continue
        }
        if (upperLine.includes('SKILL')) {
            blocks.push(createBlock('h2', 'Skills', { bold: true }))
            currentSection = 'skills'
            continue
        }
        if (upperLine.includes('SUMMARY') || upperLine.includes('PROFILE') || upperLine.includes('OBJECTIVE')) {
            blocks.push(createBlock('h2', 'Professional Summary', { bold: true }))
            currentSection = 'other'
            continue
        }

        if (line === line.toUpperCase() && line.length > 3 && line.length < 60) {
            blocks.push(createBlock('h3', line, { bold: true }))
            continue
        }

        if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || line.match(/^[\d]+\./)) {
            const cleanLine = line.replace(/^[•\-*]\s*/, '').replace(/^\d+\.\s*/, '')
            blocks.push(createBlock('bullet', cleanLine))
            continue
        }

        if (line.match(/\d{4}/) && (line.includes('-') || line.includes('to') || line.includes('Present'))) {
            blocks.push(createBlock('paragraph', line, { italic: true }))
            continue
        }

        blocks.push(createBlock('paragraph', line))
    }

    return blocks
}

const getInitialBlocks = (analysis: ResumeAnalysisResult | null, parsedData: any, extractedText: string | null): EditorBlock[] => {
    if (extractedText && extractedText.trim().length > 50) {
        return getInitialBlocksFromText(extractedText, parsedData)
    }

    const blocks: EditorBlock[] = []

    const name = parsedData?.name || "Your Name"
    const contactParts = []
    if (parsedData?.email) contactParts.push(parsedData.email)
    if (parsedData?.phone) contactParts.push(parsedData.phone)
    if (parsedData?.location) contactParts.push(parsedData.location)
    const contactLine = contactParts.join(" | ") || "email@example.com"

    blocks.push(createBlock('h1', name, { align: 'center', bold: true }))
    blocks.push(createBlock('paragraph', contactLine, { align: 'center' }))

    const summary = parsedData?.summary || parsedData?.professional_summary
    if (summary) {
        blocks.push(createBlock('h2', "Professional Summary", { bold: true }))
        blocks.push(createBlock('paragraph', summary))
    }

    if (parsedData?.experience && Array.isArray(parsedData.experience) && parsedData.experience.length > 0) {
        blocks.push(createBlock('h2', "Experience", { bold: true }))
        parsedData.experience.forEach((exp: any) => {
            const title = exp.role || exp.title || "Job Title"
            const company = exp.company || "Company"
            const date = `${exp.start_date || ""} - ${exp.end_date || "Present"}`
            blocks.push(createBlock('h3', `${title} at ${company}`, { bold: true }))
            blocks.push(createBlock('paragraph', date, { italic: true }))
            if (exp.description) {
                const lines = String(exp.description).split('\n').filter(l => l.trim().length > 0)
                lines.forEach(line => {
                    blocks.push(createBlock('bullet', line.replace(/^[-•*]\s*/, "")))
                })
            }
        })
    }

    if (parsedData?.education && Array.isArray(parsedData.education) && parsedData.education.length > 0) {
        blocks.push(createBlock('h2', "Education", { bold: true }))
        parsedData.education.forEach((edu: any) => {
            const degree = edu.degree || "Degree"
            const school = edu.institution || "University"
            blocks.push(createBlock('paragraph', `${degree} - ${school}`, { bold: true }))
        })
    }

    if (parsedData?.skills) {
        blocks.push(createBlock('h2', "Skills", { bold: true }))
        let skillText = ""
        if (Array.isArray(parsedData.skills)) {
            skillText = parsedData.skills.join(" • ")
        } else if (typeof parsedData.skills === 'object') {
            const parts = []
            if (parsedData.skills.technical) parts.push(parsedData.skills.technical.join(", "))
            if (parsedData.skills.soft) parts.push(parsedData.skills.soft.join(", "))
            skillText = parts.join(" | ")
        }
        if (skillText) blocks.push(createBlock('paragraph', skillText))
    }

    return blocks
}

// --- Components ---

const BlockRenderer = ({ block, onUpdate, onFocus, isActive, onAIRewrite }: {
    block: EditorBlock,
    onUpdate: (content: string) => void,
    onFocus: () => void,
    isActive: boolean,
    onAIRewrite: () => void
}) => {
    const Component =
        block.type === 'h1' ? 'h1' :
            block.type === 'h2' ? 'h2' :
                block.type === 'h3' ? 'h3' :
                    block.type === 'bullet' ? 'li' :
                        'p'

    const className = cn(
        "outline-none min-h-[1.2em] relative group/block py-1 px-2 -mx-2 rounded transition-all duration-200",
        // Prevent text overflow
        "break-words max-w-full overflow-hidden",
        // IMPROVED CONTRAST - Much darker text
        block.type === 'h1' && "text-[32px] font-bold mb-3 text-black leading-tight",
        block.type === 'h2' && "text-[18px] font-bold mt-6 mb-2 border-b-2 border-gray-300 pb-1 text-black uppercase tracking-wide",
        block.type === 'h3' && "text-[14px] font-semibold mt-4 mb-1 text-gray-900",
        block.type === 'paragraph' && "text-[11pt] leading-relaxed mb-1.5 text-gray-900",
        block.type === 'bullet' && "text-[11pt] leading-relaxed ml-6 relative list-disc my-0.5 text-gray-900",

        block.styles?.align === 'center' && "text-center",
        block.styles?.align === 'right' && "text-right",
        block.styles?.bold && "font-bold",
        block.styles?.italic && "italic",
        block.styles?.underline && "underline decoration-gray-600 underline-offset-2",

        isActive && "bg-blue-50 ring-2 ring-blue-200 shadow-sm"
    )

    return (
        <div className="relative group/wrapper">
            {isActive && (
                <button
                    onClick={onAIRewrite}
                    className="absolute -right-14 top-1/2 -translate-y-1/2 p-2.5 bg-[#00FF88] shadow-lg border border-[#00FF88]/20 rounded-full text-black hover:bg-[#00CC6A] transition-all scale-0 group-hover/wrapper:scale-100 animate-in zoom-in duration-200 z-50 font-semibold"
                    title="AI Rewrite with Gemini"
                >
                    <Sparkles className="h-4 w-4" />
                </button>
            )}

            <Component
                contentEditable
                suppressContentEditableWarning
                className={className}
                onInput={(e: React.FormEvent<HTMLElement>) => onUpdate(e.currentTarget.innerText)}
                onFocus={onFocus}
                style={{ textAlign: block.styles?.align }}
            >
                {block.content}
            </Component>
        </div>
    )
}

// Multi-page container component
const MultiPageEditor = ({
    blocks,
    activeBlockId,
    setActiveBlockId,
    updateBlockContent,
    deleteBlock,
    handleAIRewrite
}: {
    blocks: EditorBlock[]
    activeBlockId: string | null
    setActiveBlockId: (id: string | null) => void
    updateBlockContent: (id: string, content: string) => void
    deleteBlock: (id: string) => void
    handleAIRewrite: (block: EditorBlock) => void
}) => {
    const [pages, setPages] = useState<EditorBlock[][]>([[]])
    const contentRefs = useRef<Map<string, HTMLDivElement>>(new Map())

    // Distribute blocks across pages based on estimated heights
    useEffect(() => {
        const estimateBlockHeight = (block: EditorBlock): number => {
            // Slightly conservative height estimates in pixels (increased by 10% for safety margin)
            const baseHeights = {
                h1: 66,      // was 60
                h2: 55,      // was 50
                h3: 38,      // was 35
                paragraph: 33, // was 30
                bullet: 28    // was 25
            }

            const baseHeight = baseHeights[block.type]
            const contentLength = block.content.length
            const linesEstimate = Math.ceil(contentLength / 80) // ~80 chars per line

            return baseHeight * Math.max(1, linesEstimate)
        }

        const maxPageHeight = A4_CONTENT_HEIGHT_MM * MM_TO_PX
        const newPages: EditorBlock[][] = []
        let currentPage: EditorBlock[] = []
        let currentHeight = 0

        blocks.forEach(block => {
            const blockHeight = estimateBlockHeight(block)

            // Use 98% of max height to fill more of the page while maintaining bottom margin
            if (currentHeight + blockHeight > maxPageHeight * 0.98 && currentPage.length > 0) {
                // Start new page
                newPages.push(currentPage)
                currentPage = [block]
                currentHeight = blockHeight
            } else {
                currentPage.push(block)
                currentHeight += blockHeight
            }
        })

        if (currentPage.length > 0) {
            newPages.push(currentPage)
        }

        setPages(newPages.length > 0 ? newPages : [[]])
    }, [blocks])

    return (
        <>
            {pages.map((pageBlocks, pageIndex) => (
                <div
                    key={pageIndex}
                    className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-1 ring-gray-200 overflow-hidden relative"
                    style={{
                        width: `${A4_WIDTH_MM}mm`,
                        minHeight: `${A4_HEIGHT_MM}mm`,
                        padding: '20mm',
                        boxSizing: 'border-box'
                    }}
                >
                    {/* Page number */}
                    <div className="absolute top-2 right-4 text-xs text-gray-400 font-medium">
                        Page {pageIndex + 1} of {pages.length}
                    </div>

                    <div className="flex flex-col w-full max-w-full overflow-hidden">
                        {pageBlocks.map(block => (
                            <div key={block.id} className="relative group/line">
                                <div className="absolute -left-10 top-2 opacity-0 group-hover/line:opacity-100 transition-opacity flex flex-col items-center gap-2">
                                    <button
                                        onClick={() => deleteBlock(block.id)}
                                        className="text-gray-500 hover:text-white hover:bg-red-600 p-2 rounded-lg transition-all shadow-sm border border-gray-200 bg-white hover:border-red-600"
                                        title="Delete block"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>

                                <BlockRenderer
                                    block={block}
                                    isActive={activeBlockId === block.id}
                                    onUpdate={(content) => updateBlockContent(block.id, content)}
                                    onFocus={() => setActiveBlockId(block.id)}
                                    onAIRewrite={() => handleAIRewrite(block)}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </>
    )
}

export function ResumeEditor({ documentUrl, analysis, parsedData, extractedText, applicationId, documentId, onBack, fileName }: ResumeEditorProps) {
    const { toast } = useToast()
    const [blocks, setBlocks] = useState<EditorBlock[]>([])
    const [activeBlockId, setActiveBlockId] = useState<string | null>(null)
    const [versions, setVersions] = useState<ResumeVersion[]>([])
    const [currentVersionId, setCurrentVersionId] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [isExporting, setIsExporting] = useState(false)
    const [isRewriting, setIsRewriting] = useState(false)

    useEffect(() => {
        const load = async () => {
            try {
                const fetchedVersions = await resumeVersionsService.getVersions(documentId)
                setVersions(fetchedVersions)

                if (fetchedVersions.length > 0) {
                    const latest = fetchedVersions[0]
                    setBlocks(latest.blocks)
                    setCurrentVersionId(latest.id)
                } else {
                    let initial: EditorBlock[] = []

                    if (extractedText && extractedText.trim().length > 50) {
                        try {
                            toast({
                                title: "Parsing document structure...",
                                description: "Analyzing your resume for optimal formatting."
                            })

                            const parseResponse = await fetch('/api/editor/parse-text', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ extractedText })
                            })

                            if (parseResponse.ok) {
                                const data = await parseResponse.json()
                                if (data.blocks && Array.isArray(data.blocks)) {
                                    initial = data.blocks.map((b: any) => ({
                                        ...b,
                                        id: Math.random().toString(36).substr(2, 9)
                                    }))
                                    toast({ title: "Resume imported successfully" })
                                } else {
                                    throw new Error("Invalid AI response")
                                }
                            } else {
                                throw new Error("AI parsing failed")
                            }
                        } catch (aiError) {
                            console.warn("AI parsing failed, using fallback:", aiError)
                            initial = getInitialBlocks(analysis, parsedData, extractedText)
                        }
                    } else {
                        initial = getInitialBlocks(analysis, parsedData, extractedText)
                    }

                    setBlocks(initial)
                }
            } catch (err) {
                console.error("Load error:", err)
                toast({ title: "Failed to load resume", variant: "destructive" })
            } finally {
                setIsLoading(false)
            }
        }
        load()
    }, [documentId, analysis, parsedData, extractedText])

    const debouncedSave = useDebounceCallback(async (updatedBlocks: EditorBlock[]) => {
        if (!currentVersionId) return

        setIsSaving(true)
        try {
            const version = versions.find(v => v.id === currentVersionId)
            if (version) {
                await resumeVersionsService.saveVersion({
                    id: version.id,
                    document_id: documentId,
                    application_id: applicationId,
                    version_name: version.version_name,
                    blocks: updatedBlocks
                })
            }
        } catch (err) {
            console.error("Auto-save error:", err)
        } finally {
            setIsSaving(false)
        }
    }, 2000)

    useEffect(() => {
        if (!isLoading && currentVersionId) {
            debouncedSave(blocks)
        }
    }, [blocks, currentVersionId, isLoading, debouncedSave])

    const handleNewVersion = async () => {
        setIsSaving(true)
        try {
            const newName = `Version ${versions.length + 1}`
            const newVersion = await resumeVersionsService.saveVersion({
                document_id: documentId,
                application_id: applicationId,
                version_name: newName,
                blocks: blocks
            })
            setVersions([newVersion, ...versions])
            setCurrentVersionId(newVersion.id)
            toast({ title: "Saved as new version" })
        } catch (err) {
            toast({ title: "Failed to save", variant: "destructive" })
        } finally {
            setIsSaving(false)
        }
    }

    const switchVersion = (id: string) => {
        const version = versions.find(v => v.id === id)
        if (version) {
            setBlocks(version.blocks)
            setCurrentVersionId(id)
        }
    }

    const updateBlockContent = (id: string, content: string) => {
        setBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b))
    }

    const addBlock = (type: BlockType = 'paragraph') => {
        const newBlock = createBlock(type, "")
        if (activeBlockId) {
            const index = blocks.findIndex(b => b.id === activeBlockId)
            const next = [...blocks]
            next.splice(index + 1, 0, newBlock)
            setBlocks(next)
        } else {
            setBlocks(prev => [...prev, newBlock])
        }
        setActiveBlockId(newBlock.id)
    }

    const deleteBlock = (id: string) => {
        setBlocks(prev => prev.filter(b => b.id !== id))
        if (activeBlockId === id) setActiveBlockId(null)
    }

    const toggleStyle = (style: keyof BlockStyles, value?: any) => {
        if (!activeBlockId) return
        setBlocks(prev => prev.map(b => {
            if (b.id !== activeBlockId) return b
            const s = b.styles || {}
            return {
                ...b,
                styles: { ...s, [style]: value !== undefined ? value : !s[style as keyof BlockStyles] }
            }
        }))
    }

    const handleAIRewrite = async (block: EditorBlock) => {
        setIsRewriting(true)
        try {
            const response = await fetch('/api/editor/ai-rewrite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: block.content,
                    type: block.type,
                    analysisFeedback: analysis?.recommendations?.join("\n") || ""
                })
            })
            const data = await response.json()
            if (data.rewritten) {
                updateBlockContent(block.id, data.rewritten)
                toast({ title: "Block improved successfully", description: "Your text has been enhanced for impact and clarity." })
            }
        } catch (err) {
            toast({ title: "AI rewrite failed", variant: "destructive" })
        } finally {
            setIsRewriting(false)
        }
    }

    const handleExport = async () => {
        setIsExporting(true)
        try {
            // Dynamically import html2pdf.js
            const html2pdf = (await import('html2pdf.js')).default

            // Create a temporary container with the resume content
            const element = document.createElement('div')
            element.style.width = '170mm' // A4 width minus margins (210mm - 2*20mm)
            element.style.fontFamily = 'Inter, -apple-system, sans-serif'
            element.style.fontSize = '11pt'
            element.style.lineHeight = '1.5'
            element.style.color = '#111'
            element.style.backgroundColor = 'white'

            // Generate HTML from blocks
            blocks.forEach(block => {
                const blockEl = document.createElement(
                    block.type === 'h1' ? 'h1' :
                        block.type === 'h2' ? 'h2' :
                            block.type === 'h3' ? 'h3' :
                                block.type === 'bullet' ? 'li' : 'p'
                )

                blockEl.textContent = block.content

                // Apply styles
                if (block.type === 'h1') {
                    blockEl.style.fontSize = '32px'
                    blockEl.style.fontWeight = '700'
                    blockEl.style.margin = '0 0 8px 0'
                    blockEl.style.color = '#000'
                    blockEl.style.lineHeight = '1.2'
                }
                if (block.type === 'h2') {
                    blockEl.style.fontSize = '18px'
                    blockEl.style.fontWeight = '700'
                    blockEl.style.margin = '24px 0 8px 0'
                    blockEl.style.borderBottom = '2px solid #ddd'
                    blockEl.style.paddingBottom = '4px'
                    blockEl.style.textTransform = 'uppercase'
                    blockEl.style.letterSpacing = '0.5px'
                    blockEl.style.color = '#000'
                }
                if (block.type === 'h3') {
                    blockEl.style.fontSize = '14px'
                    blockEl.style.fontWeight = '600'
                    blockEl.style.margin = '16px 0 4px 0'
                    blockEl.style.color = '#222'
                }
                if (block.type === 'paragraph') {
                    blockEl.style.fontSize = '11pt'
                    blockEl.style.margin = '0 0 6px 0'
                    blockEl.style.color = '#333'
                }
                if (block.type === 'bullet') {
                    blockEl.style.fontSize = '11pt'
                    blockEl.style.margin = '0 0 4px 0'
                    blockEl.style.color = '#333'
                }

                // Apply alignment
                if (block.styles?.align) {
                    blockEl.style.textAlign = block.styles.align
                }
                if (block.styles?.bold) {
                    blockEl.style.fontWeight = '700'
                }
                if (block.styles?.italic) {
                    blockEl.style.fontStyle = 'italic'
                }
                if (block.styles?.underline) {
                    blockEl.style.textDecoration = 'underline'
                }

                // Group bullets into ul
                if (block.type === 'bullet') {
                    let ul = element.querySelector('ul:last-child') as HTMLUListElement | null
                    if (!ul || ul.nextSibling) {
                        ul = document.createElement('ul')
                        ul.style.margin = '0 0 12px 0'
                        ul.style.padding = '0 0 0 20px'
                        ul.style.listStyleType = 'disc'
                        element.appendChild(ul)
                    }
                    ul.appendChild(blockEl)
                } else {
                    element.appendChild(blockEl)
                }
            })

            // Generate PDF with proper margins
            const opt = {
                margin: [20, 20, 20, 20] as [number, number, number, number], // top, right, bottom, left in mm
                filename: `${fileName.replace(/\.pdf$/i, "")}_edited.pdf`,
                image: { type: 'jpeg' as const, quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    letterRendering: true,
                    backgroundColor: '#ffffff'
                },
                jsPDF: {
                    unit: 'mm' as const,
                    format: 'a4' as const,
                    orientation: 'portrait' as const,
                    compress: true
                },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            }

            await html2pdf().set(opt).from(element).save()

            toast({ title: "PDF downloaded successfully!" })
        } catch (err: any) {
            console.error("Export error:", err)
            toast({
                title: "Failed to export PDF",
                description: err.message || "An error occurred",
                variant: "destructive"
            })
        } finally {
            setIsExporting(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-gray-600 animate-pulse font-medium">Reconstructing your resume...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] bg-[#0A0A0A]">
            {/* Toolbar */}
            <div className="h-16 border-b border-[#1A1A1A] bg-[#0A0A0A] flex items-center justify-between px-6 z-20 shadow-sm sticky top-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={onBack} className="font-medium text-gray-400 hover:text-[#00FF88] hover:bg-[#1A1A1A]">
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back
                    </Button>
                    <div className="h-6 w-px bg-[#1A1A1A]" />

                    <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-gray-400" />
                        <Select value={currentVersionId || "initial"} onValueChange={switchVersion}>
                            <SelectTrigger className="w-[180px] h-9 font-medium bg-[#1A1A1A] border-[#1A1A1A] text-gray-300 hover:border-[#00FF88]">
                                <SelectValue placeholder="Current Draft" />
                            </SelectTrigger>
                            <SelectContent>
                                {versions.length === 0 && <SelectItem value="initial">Initial Import</SelectItem>}
                                {versions.map(v => (
                                    <SelectItem key={v.id} value={v.id}>{v.version_name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleNewVersion}
                            disabled={isSaving}
                            className="h-9 px-3 border-dashed font-medium bg-[#1A1A1A] border-[#00FF88]/30 text-gray-300 hover:bg-[#1A1A1A] hover:border-[#00FF88]"
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            Capture New
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Formatting Tools */}
                    <div className="flex items-center gap-1 bg-[#1A1A1A] p-1 rounded-lg border border-[#1A1A1A]">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-[#00FF88]/10 hover:text-[#00FF88]"
                            onClick={() => toggleStyle('bold')}
                            disabled={!activeBlockId}
                        >
                            <Bold className="h-4 w-4 text-gray-400" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-[#00FF88]/10 hover:text-[#00FF88]"
                            onClick={() => toggleStyle('italic')}
                            disabled={!activeBlockId}
                        >
                            <Italic className="h-4 w-4 text-gray-400" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-[#00FF88]/10 hover:text-[#00FF88]"
                            onClick={() => toggleStyle('underline')}
                            disabled={!activeBlockId}
                            title="Underline"
                        >
                            <Underline className="h-4 w-4 text-gray-400" />
                        </Button>
                        <div className="h-4 w-px bg-[#1A1A1A] mx-1" />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-[#00FF88]/10 hover:text-[#00FF88]"
                            onClick={() => toggleStyle('align', 'left')}
                            disabled={!activeBlockId}
                        >
                            <AlignLeft className="h-4 w-4 text-gray-400" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-[#00FF88]/10 hover:text-[#00FF88]"
                            onClick={() => toggleStyle('align', 'center')}
                            disabled={!activeBlockId}
                        >
                            <AlignCenter className="h-4 w-4 text-gray-400" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-[#00FF88]/10 hover:text-[#00FF88]"
                            onClick={() => toggleStyle('align', 'right')}
                            disabled={!activeBlockId}
                        >
                            <AlignRight className="h-4 w-4 text-gray-400" />
                        </Button>
                    </div>

                    {/* Block Actions */}
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => activeBlockId && handleAIRewrite(blocks.find(b => b.id === activeBlockId)!)}
                            disabled={!activeBlockId}
                            className="font-medium bg-[#00FF88] border-[#00FF88] text-black hover:bg-[#00CC6A] hover:border-[#00CC6A] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Sparkles className="h-3 w-3 mr-1" /> Ask AI
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => activeBlockId && deleteBlock(activeBlockId)}
                            disabled={!activeBlockId}
                            className="font-medium bg-[#1A1A1A] border-[#1A1A1A] text-gray-300 hover:bg-red-600 hover:border-red-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Trash2 className="h-3 w-3 mr-1" /> Delete
                        </Button>
                    </div>

                    <div className="h-6 w-px bg-[#1A1A1A]" />

                    {/* Add Block Buttons */}
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" onClick={() => addBlock('paragraph')} className="font-medium bg-[#1A1A1A] border-[#1A1A1A] text-gray-300 hover:bg-[#00FF88]/10 hover:border-[#00FF88] hover:text-[#00FF88]"><Plus className="h-3 w-3 mr-1" /> Text</Button>
                        <Button variant="outline" size="sm" onClick={() => addBlock('h2')} className="font-medium bg-[#1A1A1A] border-[#1A1A1A] text-gray-300 hover:bg-[#00FF88]/10 hover:border-[#00FF88] hover:text-[#00FF88]"><Type className="h-3 w-3 mr-1" /> Heading</Button>
                        <Button variant="outline" size="sm" onClick={() => addBlock('bullet')} className="font-medium bg-[#1A1A1A] border-[#1A1A1A] text-gray-300 hover:bg-[#00FF88]/10 hover:border-[#00FF88] hover:text-[#00FF88]"><List className="h-3 w-3 mr-1" /> Bullet</Button>
                    </div>

                    <Button onClick={handleExport} disabled={isExporting} className="glow-effect font-semibold">
                        <Download className="h-4 w-4 mr-2" /> Download PDF
                    </Button>
                </div>
            </div>

            {/* Editor Canvas - Multi-page layout */}
            <div className="flex-1 overflow-auto p-12 flex flex-col items-center gap-8 custom-scrollbar bg-[#0A0A0A]">
                {isRewriting && (
                    <div className="fixed inset-0 bg-white/30 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none">
                        <div className="bg-white p-5 rounded-2xl shadow-2xl flex items-center gap-4 border-2 border-purple-100 animate-in zoom-in duration-300">
                            <div className="relative">
                                <Sparkles className="h-6 w-6 text-purple-500 animate-pulse" />
                                <div className="absolute inset-0 bg-purple-400 blur-xl opacity-50 animate-pulse" />
                            </div>
                            <span className="font-bold text-gray-800 text-lg">AI is polishing your words...</span>
                        </div>
                    </div>
                )}

                <MultiPageEditor
                    blocks={blocks}
                    activeBlockId={activeBlockId}
                    setActiveBlockId={setActiveBlockId}
                    updateBlockContent={updateBlockContent}
                    deleteBlock={deleteBlock}
                    handleAIRewrite={handleAIRewrite}
                />
            </div>

            {/* Status Footer */}
            <div className="h-8 border-t border-[#1A1A1A] bg-[#0A0A0A] px-4 flex items-center justify-between text-[11px] text-gray-500 uppercase tracking-widest font-medium">
                <div className="flex items-center gap-4">
                    <span>Document: {fileName}</span>
                    <span>Version: {currentVersionId ? versions.find(v => v.id === currentVersionId)?.version_name : 'Unsaved Draft'}</span>
                </div>
                <div className="flex items-center gap-2">
                    {isSaving ? (
                        <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Saving changes...</span>
                        </>
                    ) : (
                        <span className="text-green-600">✓ Changes saved</span>
                    )}
                </div>
            </div>
        </div>
    )
}
