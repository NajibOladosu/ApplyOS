"use client"

import { EditorContent, type Editor } from "@tiptap/react"
import { cn } from "@/shared/lib/utils"

interface Props {
    editor: Editor | null
    pageNumber?: number
    totalPages?: number
}

export function ClassicTemplate({ editor, pageNumber, totalPages }: Props) {
    return (
        <div
            className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-1 ring-gray-200 relative resume-template-classic"
            style={{
                width: '210mm',
                minHeight: '297mm',
                padding: '20mm',
                boxSizing: 'border-box',
                fontFamily: '"Source Serif Pro", Georgia, serif',
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
                    "max-w-none",
                    "[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-full",
                    "[&_h1]:text-[26pt] [&_h1]:font-bold [&_h1]:text-center [&_h1]:tracking-wider [&_h1]:mb-2 [&_h1]:text-black",
                    "[&_h2]:text-[13pt] [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-[1.2px] [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:pb-0.5 [&_h2]:border-b [&_h2]:border-black [&_h2]:text-black",
                    "[&_h3]:text-[11.5pt] [&_h3]:font-bold [&_h3]:italic [&_h3]:mt-3 [&_h3]:mb-0.5 [&_h3]:text-gray-900",
                    "[&_p]:text-[11pt] [&_p]:leading-[1.55] [&_p]:my-1.5 [&_p]:text-gray-900",
                    "[&_ul]:my-2 [&_ul]:pl-6 [&_ul]:list-disc",
                    "[&_li]:text-[11pt] [&_li]:leading-[1.55] [&_li]:my-1 [&_li]:text-gray-900",
                    "[&_strong]:font-bold [&_strong]:text-black",
                    "[&_em]:italic [&_a]:text-blue-700 [&_a]:underline",
                )}
            />
        </div>
    )
}
