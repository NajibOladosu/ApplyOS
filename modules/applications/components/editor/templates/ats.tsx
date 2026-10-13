"use client"

import { EditorContent, type Editor } from "@tiptap/react"
import { cn } from "@/shared/lib/utils"
import type { DocSettings } from "../types"

interface AtsTemplateProps {
    editor: Editor | null
    pageNumber?: number
    totalPages?: number
    docSettings?: DocSettings
}

const DEFAULT_ATS_MARGINS: DocSettings = {
    marginTopMm: 12,
    marginRightMm: 14,
    marginBottomMm: 12,
    marginLeftMm: 14,
}

/**
 * A deliberately restrained, single-column resume layout. It avoids tables,
 * sidebars, icons, photos, and decorative glyphs so the visual hierarchy also
 * remains legible to common ATS text extractors.
 */
export function AtsTemplate({ editor, pageNumber, totalPages, docSettings }: AtsTemplateProps) {
    const settings = docSettings ?? DEFAULT_ATS_MARGINS

    return (
        <div
            className="relative bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-1 ring-slate-200"
            style={{
                width: '210mm',
                minHeight: '297mm',
                paddingTop: `${settings.marginTopMm}mm`,
                paddingRight: `${settings.marginRightMm}mm`,
                paddingBottom: `${settings.marginBottomMm}mm`,
                paddingLeft: `${settings.marginLeftMm}mm`,
                boxSizing: 'border-box',
                fontFamily: 'Arial, Helvetica, sans-serif',
                backgroundImage:
                    'repeating-linear-gradient(to bottom, transparent 0, transparent calc(297mm - 2px), rgba(15,23,42,0.08) calc(297mm - 2px), rgba(15,23,42,0.08) 297mm)',
                backgroundSize: '100% 297mm',
                backgroundRepeat: 'repeat-y',
                backgroundPosition: '0 0',
            }}
        >
            {pageNumber && totalPages && totalPages > 1 ? (
                <div className="absolute right-4 top-2 text-xs font-medium text-slate-400">
                    Page {pageNumber} of {totalPages}
                </div>
            ) : null}
            <EditorContent
                editor={editor}
                className={cn(
                    "max-w-none text-slate-950",
                    "[&_.ProseMirror]:min-h-full [&_.ProseMirror]:outline-none",
                    "[&_h1]:m-0 [&_h1]:text-center [&_h1]:text-[20pt] [&_h1]:font-bold [&_h1]:leading-none [&_h1]:tracking-[0.02em] [&_h1]:text-black",
                    "[&_h1+ p]:mt-1 [&_h1+ p]:text-center [&_h1+ p]:text-[9pt] [&_h1+ p]:leading-[1.2]",
                    "[&_h2]:mb-1 [&_h2]:mt-2.5 [&_h2]:border-b [&_h2]:border-black [&_h2]:pb-0.5 [&_h2]:text-[10pt] [&_h2]:font-bold [&_h2]:uppercase [&_h2]:leading-[1.15] [&_h2]:tracking-[0.08em] [&_h2]:text-black",
                    "[&_h3]:mb-0 [&_h3]:mt-1.5 [&_h3]:text-[9.5pt] [&_h3]:font-bold [&_h3]:leading-[1.15] [&_h3]:text-black",
                    "[&_p]:my-0.5 [&_p]:text-[9.25pt] [&_p]:leading-[1.24] [&_p]:text-slate-900",
                    "[&_ul]:mb-1.5 [&_ul]:mt-0.5 [&_ul]:list-disc [&_ul]:pl-4",
                    "[&_ol]:mb-1.5 [&_ol]:mt-0.5 [&_ol]:list-decimal [&_ol]:pl-4",
                    "[&_li]:my-0 [&_li]:pl-0.5 [&_li]:text-[9.25pt] [&_li]:leading-[1.24] [&_li]:text-slate-900",
                    "[&_strong]:font-bold [&_strong]:text-black",
                    "[&_a]:text-black [&_a]:underline [&_a]:underline-offset-2",
                )}
            />
        </div>
    )
}
