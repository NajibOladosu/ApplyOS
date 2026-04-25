"use client"

import { EditorContent, type Editor } from "@tiptap/react"
import { cn } from "@/lib/utils"
import { User as UserIcon } from "lucide-react"

interface Props {
    editor: Editor | null
    pageNumber?: number
    totalPages?: number
    photoUrl?: string | null
}

/**
 * Photo-header template: banner at top with avatar + name. The TipTap editor
 * still owns the H1 below the banner so the user can edit name/contact normally.
 * The first H1 is styled inside the banner-style stripe via CSS, while the
 * avatar lives in a separate non-editable slot — visual only.
 */
export function PhotoHeaderTemplate({ editor, pageNumber, totalPages, photoUrl }: Props) {
    return (
        <div
            className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-1 ring-gray-200 relative resume-template-photo-header overflow-hidden"
            style={{
                width: '210mm',
                minHeight: '297mm',
                boxSizing: 'border-box',
                fontFamily: 'Manrope, -apple-system, sans-serif',
            }}
        >
            {pageNumber && totalPages && totalPages > 1 && (
                <div className="absolute top-2 right-4 text-xs text-gray-400 font-medium z-10">
                    Page {pageNumber} of {totalPages}
                </div>
            )}

            <div className="flex items-center gap-6 bg-gradient-to-r from-emerald-50 to-emerald-100 border-b-4 border-emerald-600 px-[20mm] py-6">
                <div className="flex-shrink-0 h-24 w-24 rounded-full bg-white ring-2 ring-emerald-600 flex items-center justify-center overflow-hidden">
                    {photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                        <UserIcon className="h-10 w-10 text-emerald-600" />
                    )}
                </div>
                <div className="text-emerald-900 text-xs uppercase tracking-widest font-semibold">
                    Profile
                </div>
            </div>

            <div className="px-[20mm] py-6">
                <EditorContent
                    editor={editor}
                    className={cn(
                        "max-w-none",
                        "[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-full",
                        "[&_h1]:text-[28pt] [&_h1]:font-bold [&_h1]:mb-2 [&_h1]:text-black [&_h1]:leading-tight",
                        "[&_h2]:text-[13pt] [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:pb-1 [&_h2]:border-b-2 [&_h2]:border-emerald-600 [&_h2]:text-emerald-700",
                        "[&_h3]:text-[11.5pt] [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-0.5 [&_h3]:text-gray-900",
                        "[&_p]:text-[11pt] [&_p]:leading-[1.5] [&_p]:my-1.5 [&_p]:text-gray-900",
                        "[&_ul]:my-2 [&_ul]:pl-6 [&_ul]:list-disc",
                        "[&_li]:text-[11pt] [&_li]:leading-[1.5] [&_li]:my-0.5 [&_li]:text-gray-900",
                        "[&_strong]:font-bold [&_strong]:text-black",
                    )}
                />
            </div>
        </div>
    )
}
