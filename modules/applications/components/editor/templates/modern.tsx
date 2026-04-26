"use client"

import { EditorContent, type Editor } from "@tiptap/react"
import { cn } from "@/shared/lib/utils"
import type { DocSettings } from "../types"
import { DEFAULT_DOC_SETTINGS } from "../types"

const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297

interface ModernTemplateProps {
    editor: Editor | null
    pageNumber?: number
    totalPages?: number
    docSettings?: DocSettings
}

export function ModernTemplate({ editor, pageNumber, totalPages, docSettings }: ModernTemplateProps) {
    const settings = docSettings ?? DEFAULT_DOC_SETTINGS
    return (
        <div
            className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-1 ring-gray-200 relative resume-template-modern"
            style={{
                width: `${A4_WIDTH_MM}mm`,
                minHeight: `${A4_HEIGHT_MM}mm`,
                paddingTop: `${settings.marginTopMm}mm`,
                paddingRight: `${settings.marginRightMm}mm`,
                paddingBottom: `${settings.marginBottomMm}mm`,
                paddingLeft: `${settings.marginLeftMm}mm`,
                boxSizing: 'border-box',
                backgroundImage:
                    'repeating-linear-gradient(to bottom, transparent 0, transparent calc(297mm - 2px), rgba(15,23,42,0.08) calc(297mm - 2px), rgba(15,23,42,0.08) 297mm)',
                backgroundSize: '100% 297mm',
                backgroundRepeat: 'repeat-y',
                backgroundPosition: '0 0',
                backgroundOrigin: 'border-box',
            }}
        >
            {pageNumber !== undefined && totalPages !== undefined && totalPages > 1 && (
                <div className="absolute top-2 right-4 text-xs text-gray-400 font-medium">
                    Page {pageNumber} of {totalPages}
                </div>
            )}
            <EditorContent
                editor={editor}
                className={cn(
                    "prose prose-sm max-w-none",
                    "prose-headings:text-black prose-headings:font-bold",
                    "prose-h1:text-[32px] prose-h1:leading-tight prose-h1:mb-2 prose-h1:text-center",
                    "prose-h2:text-[18px] prose-h2:uppercase prose-h2:tracking-wide prose-h2:mt-6 prose-h2:mb-2 prose-h2:pb-1 prose-h2:border-b-2 prose-h2:border-gray-300",
                    "prose-h3:text-[14px] prose-h3:font-semibold prose-h3:mt-4 prose-h3:mb-1 prose-h3:text-gray-900",
                    "prose-p:text-[11pt] prose-p:leading-relaxed prose-p:my-1.5 prose-p:text-gray-900",
                    "prose-li:text-[11pt] prose-li:leading-relaxed prose-li:my-0.5 prose-li:text-gray-900",
                    "prose-ul:my-2 prose-ul:pl-6",
                    "prose-strong:font-bold prose-strong:text-black",
                    "prose-em:italic",
                    "[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-full",
                    "[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-400 [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0",
                )}
            />
        </div>
    )
}
