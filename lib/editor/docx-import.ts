import mammoth from "mammoth"
import { generateJSON } from "@tiptap/html"
import StarterKit from "@tiptap/starter-kit"
import TextAlign from "@tiptap/extension-text-align"
import type { JSONContent } from "@tiptap/core"

/**
 * Convert a DOCX buffer to a TipTap JSON document.
 *
 * Uses mammoth's HTML conversion (preserves headings, lists, bold/italic)
 * and re-parses the HTML through TipTap's schema so the output matches
 * exactly what the editor will render.
 */
export async function docxBufferToTipTap(buffer: Buffer): Promise<JSONContent> {
    const { value: html } = await mammoth.convertToHtml(
        { buffer },
        {
            styleMap: [
                "p[style-name='Heading 1'] => h1:fresh",
                "p[style-name='Heading 2'] => h2:fresh",
                "p[style-name='Heading 3'] => h3:fresh",
                "p[style-name='Title'] => h1:fresh",
                "b => strong",
                "i => em",
                "u => u",
            ],
        },
    )

    const extensions = [
        StarterKit.configure({
            heading: { levels: [1, 2, 3] },
            link: { openOnClick: false },
        }),
        TextAlign.configure({
            types: ['heading', 'paragraph'],
            alignments: ['left', 'center', 'right', 'justify'],
        }),
    ]

    if (!html || !html.trim()) {
        return { type: 'doc', content: [{ type: 'paragraph' }] }
    }

    const json = generateJSON(html, extensions)
    return json
}
