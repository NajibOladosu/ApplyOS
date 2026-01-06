"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Download, Plus, Type, AlignLeft, AlignCenter, AlignRight, Bold, Italic, List, Trash2 } from "lucide-react"
import { type ResumeAnalysisResult } from "./resume-feedback"
import { cn } from "@/lib/utils"

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
    onBack: () => void
    fileName: string
}

// --- Constants ---

const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297

// --- Initial Data Conversion ---

const createBlock = (type: BlockType, content: string, styles: BlockStyles = {}): EditorBlock => ({
    id: Math.random().toString(36).substr(2, 9),
    type,
    content,
    styles
})

// Convert the analysis/parsed data into initial blocks
const getInitialBlocks = (analysis: ResumeAnalysisResult | null, parsedData: any): EditorBlock[] => {
    const blocks: EditorBlock[] = []

    // 1. Header (Name & Contact)
    // parsedData usually has: name, email, phone, location, links
    const name = parsedData?.name || "Your Name"
    const contactParts = []
    if (parsedData?.email) contactParts.push(parsedData.email)
    if (parsedData?.phone) contactParts.push(parsedData.phone)
    if (parsedData?.location) contactParts.push(parsedData.location)
    if (parsedData?.links && Array.isArray(parsedData.links)) {
        parsedData.links.forEach((l: string) => contactParts.push(l))
    }
    const contactLine = contactParts.join(" | ") || "email@example.com | (555) 123-4567 | City, State"

    blocks.push(createBlock('h1', name, { align: 'center', bold: true }))
    blocks.push(createBlock('paragraph', contactLine, { align: 'center' }))

    // 2. Summary
    // Parsing might have 'summary' or 'professional_summary'
    const summary = parsedData?.summary || parsedData?.professional_summary
    if (summary) {
        blocks.push(createBlock('h2', "Professional Summary", { bold: true }))
        blocks.push(createBlock('paragraph', summary))
    } else if (analysis?.strengths && analysis.strengths.length > 0) {
        // Fallback to analysis strengths if no summary parsed
        blocks.push(createBlock('h2', "Professional Summary", { bold: true }))
        blocks.push(createBlock('paragraph', "Driven professional with a focus on delivering high-quality results."))
    }

    // 3. Experience
    if (parsedData?.experience && Array.isArray(parsedData.experience) && parsedData.experience.length > 0) {
        blocks.push(createBlock('h2', "Experience", { bold: true }))

        parsedData.experience.forEach((exp: any) => {
            const title = exp.role || exp.title || "Job Title"
            const company = exp.company || "Company"
            const date = `${exp.start_date || ""} - ${exp.end_date || "Present"}`
            const location = exp.location || ""

            blocks.push(createBlock('h3', `${title} at ${company}`, { bold: true }))
            blocks.push(createBlock('paragraph', `${date} ${location ? "| " + location : ""}`, { italic: true }))

            if (exp.description) {
                // Try to split description into bullets if it looks like a list or has newlines
                const lines = exp.description.split('\n').filter((l: string) => l.trim().length > 0)
                if (lines.length > 1) {
                    lines.forEach((line: string) => {
                        const cleanLine = line.replace(/^[-•*]\s*/, "") // Remove existing bullet chars
                        blocks.push(createBlock('bullet', cleanLine))
                    })
                } else {
                    blocks.push(createBlock('paragraph', exp.description))
                }
            }
        })
    } else {
        // Fallback template if absolutely no data
        if (blocks.length === 2 && !summary) { // Only name/contact so far
            blocks.push(createBlock('h2', "Experience", { bold: true }))
            blocks.push(createBlock('h3', "Job Title at Company", { bold: true }))
            blocks.push(createBlock('paragraph', "Date - Date | Location", { italic: true }))
            blocks.push(createBlock('bullet', "Accomplished X using Y."))
        }
    }

    // 4. Education
    if (parsedData?.education && Array.isArray(parsedData.education) && parsedData.education.length > 0) {
        blocks.push(createBlock('h2', "Education", { bold: true }))
        parsedData.education.forEach((edu: any) => {
            const degree = edu.degree || "Degree"
            const field = edu.field ? ` in ${edu.field}` : ""
            const school = edu.institution || "University"
            const date = `${edu.start_date || ""} - ${edu.end_date || ""}`

            blocks.push(createBlock('paragraph', `${degree}${field} - ${school}`))
            if (date.length > 3) blocks.push(createBlock('paragraph', date, { italic: true }))
        })
    }

    // 5. Skills
    if (parsedData?.skills) {
        blocks.push(createBlock('h2', "Skills", { bold: true }))

        const allSkills = []
        if (Array.isArray(parsedData.skills)) {
            allSkills.push(...parsedData.skills)
        } else {
            // Structure might be { technical: [], soft: [] }
            if (parsedData.skills.technical) allSkills.push(...parsedData.skills.technical)
            if (parsedData.skills.soft) allSkills.push(...parsedData.skills.soft)
            if (parsedData.skills.languages) allSkills.push(...parsedData.skills.languages)
            if (parsedData.skills.tools) allSkills.push(...parsedData.skills.tools)
        }

        if (allSkills.length > 0) {
            blocks.push(createBlock('paragraph', allSkills.join(" • ")))
        }
    }

    return blocks
}


// --- Components ---

const BlockRenderer = ({ block, onUpdate, onFocus, isActive }: {
    block: EditorBlock,
    onUpdate: (content: string) => void,
    onFocus: () => void,
    isActive: boolean
}) => {
    const Component =
        block.type === 'h1' ? 'h1' :
            block.type === 'h2' ? 'h2' :
                block.type === 'h3' ? 'h3' :
                    block.type === 'bullet' ? 'li' :
                        'p'

    const className = cn(
        "outline-none min-h-[1.5em] transition-colors duration-200",
        // Empty state
        "empty:before:content-['Type...'] empty:before:text-gray-300",

        // Typography - Improved Contrast
        block.type === 'h1' && "text-4xl font-bold mb-4 text-foreground",
        block.type === 'h2' && "text-2xl font-bold mt-6 mb-2 border-b-2 border-primary/20 pb-1 text-foreground",
        block.type === 'h3' && "text-lg font-semibold mt-4 mb-1 text-foreground",
        block.type === 'paragraph' && "text-base leading-relaxed mb-2 text-foreground/90",
        block.type === 'bullet' && "text-base leading-relaxed ml-4 relative list-disc my-1 text-foreground/90",

        // Styles
        block.styles?.align === 'center' && "text-center",
        block.styles?.align === 'right' && "text-right",
        block.styles?.bold && "font-bold",
        block.styles?.italic && "italic",
        block.styles?.underline && "underline ml-1",

        // Active State Indicator
        isActive && "bg-blue-50/50 rounded -mx-2 px-2 ring-1 ring-blue-100"
    )

    return (
        <Component
            contentEditable
            suppressContentEditableWarning
            className={className}
            onInput={(e: React.FormEvent<HTMLElement>) => onUpdate(e.currentTarget.innerText)}
            onFocus={onFocus}
            style={{
                textAlign: block.styles?.align
            }}
        >
            {block.content}
        </Component>
    )
}


export function ResumeEditor({ documentUrl, analysis, parsedData, onBack, fileName }: ResumeEditorProps) {
    const [blocks, setBlocks] = useState<EditorBlock[]>([])
    const [activeBlockId, setActiveBlockId] = useState<string | null>(null)
    const [isExporting, setIsExporting] = useState(false)

    useEffect(() => {
        // Initialize only if empty
        if (blocks.length === 0) {
            setBlocks(getInitialBlocks(analysis, parsedData))
        }
    }, [analysis, parsedData]) // Re-run if parsedData changes

    const updateBlockContent = (id: string, content: string) => {
        setBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b))
    }

    const addBlock = (type: BlockType = 'paragraph') => {
        const newBlock = createBlock(type, "")
        // Insert after active block or at end
        if (activeBlockId) {
            const index = blocks.findIndex(b => b.id === activeBlockId)
            const newBlocks = [...blocks]
            newBlocks.splice(index + 1, 0, newBlock)
            setBlocks(newBlocks)
            setActiveBlockId(newBlock.id)
        } else {
            setBlocks(prev => [...prev, newBlock])
            setActiveBlockId(newBlock.id)
        }
    }

    const deleteBlock = (id: string) => {
        setBlocks(prev => prev.filter(b => b.id !== id))
        if (activeBlockId === id) setActiveBlockId(null)
    }

    // --- Styles API ---
    const toggleStyle = (style: keyof BlockStyles, value?: any) => {
        if (!activeBlockId) return
        setBlocks(prev => prev.map(b => {
            if (b.id !== activeBlockId) return b
            const currentStyles = b.styles || {}
            return {
                ...b,
                styles: {
                    ...currentStyles,
                    // Toggle boolean if no value provided, else set value
                    [style]: value !== undefined ? value : !currentStyles[style as keyof BlockStyles]
                }
            }
        }))
    }

    const handleExport = async () => {
        setIsExporting(true)
        // TODO: Implement actual PDF export via Puppeteer API
        await new Promise(r => setTimeout(r, 2000)) // Mock delay
        alert("Export to PDF coming in Phase 2!")
        setIsExporting(false)
    }

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] bg-gray-50/50 animate-in slide-in-from-right duration-300">
            {/* Toolbar */}
            <div className="h-16 border-b bg-background flex items-center justify-between px-6 z-10 shadow-sm shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div className="h-6 w-px bg-border mx-2" />

                    {/* Formatting Tools */}
                    <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg border">
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background hover:shadow-sm transition-all" onClick={() => toggleStyle('bold')}>
                            <Bold className="h-4 w-4 text-foreground/70" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background hover:shadow-sm transition-all" onClick={() => toggleStyle('italic')}>
                            <Italic className="h-4 w-4 text-foreground/70" />
                        </Button>
                        <div className="h-4 w-px bg-border mx-1" />
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background hover:shadow-sm transition-all" onClick={() => toggleStyle('align', 'left')}>
                            <AlignLeft className="h-4 w-4 text-foreground/70" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background hover:shadow-sm transition-all" onClick={() => toggleStyle('align', 'center')}>
                            <AlignCenter className="h-4 w-4 text-foreground/70" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background hover:shadow-sm transition-all" onClick={() => toggleStyle('align', 'right')}>
                            <AlignRight className="h-4 w-4 text-foreground/70" />
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 mr-4">
                        <Button variant="outline" size="sm" onClick={() => addBlock('paragraph')} className="border-dashed">
                            <Plus className="h-3 w-3 mr-1" /> Text
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => addBlock('h2')} className="border-dashed">
                            <Type className="h-3 w-3 mr-1" /> Heading
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => addBlock('bullet')} className="border-dashed">
                            <List className="h-3 w-3 mr-1" /> List
                        </Button>
                    </div>

                    <Button onClick={handleExport} disabled={isExporting} className="glow-effect shadow-lg shadow-primary/20">
                        <Download className="h-4 w-4 mr-2" />
                        Download PDF
                    </Button>
                </div>
            </div>

            {/* Editor Surface */}
            <div className="flex-1 overflow-auto p-8 flex justify-center custom-scrollbar bg-gray-100/50">
                <div
                    className="bg-white shadow-[0_0_50px_-12px_rgba(0,0,0,0.25)] transition-all duration-300 transform-gpu ring-1 ring-black/5"
                    style={{
                        width: `${A4_WIDTH_MM}mm`,
                        minHeight: `${A4_HEIGHT_MM}mm`,
                        padding: '20mm', // Standard print margin
                        // Scale could go here
                    }}
                    onClick={() => {
                        // Deselect if clicking outside any block
                        // setActiveBlockId(null) 
                    }}
                >
                    <div className="flex flex-col h-full w-full">
                        {blocks.map(block => (
                            <div key={block.id} className="group relative -ml-12 pl-12">
                                {/* Hover Actions Block - Floating left gutter */}
                                <div className="absolute left-0 top-1 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center w-8">
                                    <button
                                        onClick={() => deleteBlock(block.id)}
                                        className="text-muted-foreground hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 transition-colors"
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
                                />
                            </div>
                        ))}

                        {blocks.length === 0 && (
                            <div className="flex flex-col items-center justify-center text-center text-muted-foreground mt-32 space-y-4">
                                <div className="p-4 bg-muted/50 rounded-full">
                                    <Type className="h-8 w-8 text-muted-foreground/50" />
                                </div>
                                <div>
                                    <p className="font-medium">Page is empty</p>
                                    <p className="text-sm">Add a block from the toolbar to start writing.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
