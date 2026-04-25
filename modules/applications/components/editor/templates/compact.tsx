"use client"

import { EditorContent, type Editor } from "@tiptap/react"
import { cn } from "@/shared/lib/utils"

interface Props {
    editor: Editor | null
    pageNumber?: number
    totalPages?: number
}

export function CompactTemplate({ editor, pageNumber, totalPages }: Props) {
    return (
        <div
            className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-1 ring-gray-200 relative resume-template-compact"
            style={{
                width: '210mm',
                minHeight: '297mm',
                padding: '15mm 18mm',
                boxSizing: 'border-box',
                fontFamily: 'Inter, -apple-system, sans-serif',
                backgroundImage:
                    'repeating-linear-gradient(to bottom, transparent 0, transparent calc(297mm - 2px), rgba(15,23,42,0.08) calc(297mm - 2px), rgba(15,23,42,0.08) 297mm)',
                backgroundSize: '100% 297mm',
                backgroundRepeat: 'repeat-y',
                backgroundPosition: '0 0',
            }}
        >
            {pageNumber && totalPages && totalPages > 1 && (
                <div className="absolute top-2 right-4 text-xs text-gray-400 font-medium">
                    Page {pageNumber} of {totalPages}
                </div>
            )}
            <EditorContent
                editor={editor}
                className={cn(
                    "max-w-none text-[10pt] leading-[1.35]",
                    "[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-full",
                    "[&_h1]:text-[22pt] [&_h1]:font-bold [&_h1]:mb-1 [&_h1]:text-black [&_h1]:leading-[1.05]",
                    "[&_h2]:text-[11pt] [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:pb-0.5 [&_h2]:border-b [&_h2]:border-gray-300 [&_h2]:text-black",
                    "[&_h3]:text-[10.5pt] [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-0 [&_h3]:text-gray-900",
                    "[&_p]:text-[10pt] [&_p]:leading-[1.35] [&_p]:my-0.5 [&_p]:text-gray-900",
                    "[&_ul]:my-1 [&_ul]:pl-5 [&_ul]:list-disc",
                    "[&_li]:text-[10pt] [&_li]:leading-[1.35] [&_li]:my-0 [&_li]:text-gray-900",
                    "[&_strong]:font-bold [&_strong]:text-black",
                )}
            />
        </div>
    )
}
