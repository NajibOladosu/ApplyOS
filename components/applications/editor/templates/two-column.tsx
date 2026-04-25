"use client"

import { EditorContent, type Editor } from "@tiptap/react"
import { cn } from "@/lib/utils"

interface Props {
    editor: Editor | null
    pageNumber?: number
    totalPages?: number
}

/**
 * Two-column layout via CSS multi-column. Single editor instance keeps editing
 * simple; H1 spans both columns so the name + contact stay full-width while the
 * body flows across two columns.
 */
export function TwoColumnTemplate({ editor, pageNumber, totalPages }: Props) {
    return (
        <div
            className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-1 ring-gray-200 relative resume-template-two-column"
            style={{
                width: '210mm',
                minHeight: '297mm',
                padding: '20mm',
                boxSizing: 'border-box',
                fontFamily: 'Inter, -apple-system, sans-serif',
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
                    "max-w-none",
                    "[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-full",
                    "[&_.ProseMirror]:[column-count:2] [&_.ProseMirror]:[column-gap:8mm] [&_.ProseMirror]:[column-rule:1px_solid_#e5e7eb]",
                    "[&_h1]:text-[26pt] [&_h1]:font-bold [&_h1]:mb-2 [&_h1]:text-black [&_h1]:[column-span:all] [&_h1]:[break-after:column]",
                    "[&_h2]:text-[12pt] [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:pb-0.5 [&_h2]:border-b-2 [&_h2]:border-emerald-600 [&_h2]:text-emerald-700 [&_h2]:[break-inside:avoid] [&_h2]:[break-after:avoid]",
                    "[&_h3]:text-[11.5pt] [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-0.5 [&_h3]:text-gray-900 [&_h3]:[break-inside:avoid] [&_h3]:[break-after:avoid]",
                    "[&_p]:text-[11pt] [&_p]:leading-[1.5] [&_p]:my-1.5 [&_p]:text-gray-900",
                    "[&_ul]:my-2 [&_ul]:pl-5 [&_ul]:list-disc",
                    "[&_li]:text-[11pt] [&_li]:leading-[1.5] [&_li]:my-0.5 [&_li]:text-gray-900 [&_li]:[break-inside:avoid]",
                    "[&_strong]:font-bold [&_strong]:text-black",
                )}
            />
        </div>
    )
}
