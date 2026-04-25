import { generateHTML } from "@tiptap/html"
import type { JSONContent } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import TextAlign from "@tiptap/extension-text-align"
import type { TemplateId } from "@/modules/applications/components/editor/types"

// Server-side schema must mirror the editor's schema so generateHTML produces
// identical markup. Placeholder is editor-only (decoration), excluded here.
const renderExtensions = [
    StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false },
    }),
    TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
    }),
]

/**
 * Server-side TipTap JSON -> print-ready HTML string. Used by the PDF export route.
 * Each template owns its own page CSS so the PDF preserves the template's look.
 */

interface RenderOpts {
    contentJson: JSONContent
    templateId: TemplateId
    fileName?: string
}

const baseStyles = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=Source+Serif+Pro:wght@400;600;700&display=swap');

@page {
    size: A4;
    margin: 20mm 20mm 20mm 20mm;
}

* { box-sizing: border-box; }

html, body {
    margin: 0;
    padding: 0;
    background: white;
    color: #111827;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

.resume-page {
    max-width: 170mm;
    margin: 0 auto;
}

p { margin: 0 0 6px 0; orphans: 3; widows: 3; }
ul, ol { margin: 4px 0 12px 0; padding-left: 22px; page-break-inside: avoid; }
li { margin-bottom: 4px; orphans: 2; widows: 2; }
strong { font-weight: 700; }
em { font-style: italic; }
u { text-decoration: underline; }
a { color: #1d4ed8; text-decoration: underline; }
h1, h2, h3 { page-break-after: avoid; }
`.trim()

const templateStyles: Record<TemplateId, string> = {
    'modern': `
        body { font-family: 'Inter', -apple-system, sans-serif; font-size: 11pt; line-height: 1.5; }
        h1 { font-size: 28pt; font-weight: 700; margin: 0 0 6px 0; color: #000; line-height: 1.1; }
        h2 { font-size: 13pt; font-weight: 700; margin: 18px 0 6px 0; padding-bottom: 4px;
             border-bottom: 1.5px solid #d1d5db; text-transform: uppercase; letter-spacing: 0.6px; color: #111; }
        h3 { font-size: 11.5pt; font-weight: 600; margin: 12px 0 2px 0; color: #1f2937; }
        p, li { color: #1f2937; }
    `,
    'classic': `
        body { font-family: 'Source Serif Pro', Georgia, serif; font-size: 11pt; line-height: 1.55; }
        h1 { font-size: 26pt; font-weight: 700; margin: 0 0 8px 0; text-align: center; letter-spacing: 1px; }
        h2 { font-size: 13pt; font-weight: 700; margin: 18px 0 6px 0; padding-bottom: 3px;
             border-bottom: 1px solid #111; text-transform: uppercase; letter-spacing: 1.2px; }
        h3 { font-size: 11.5pt; font-weight: 700; margin: 12px 0 2px 0; font-style: italic; }
    `,
    'compact': `
        body { font-family: 'Inter', sans-serif; font-size: 10pt; line-height: 1.35; }
        h1 { font-size: 22pt; font-weight: 700; margin: 0 0 4px 0; line-height: 1.05; }
        h2 { font-size: 11pt; font-weight: 700; margin: 12px 0 4px 0; padding-bottom: 2px;
             border-bottom: 1px solid #d1d5db; text-transform: uppercase; letter-spacing: 0.5px; }
        h3 { font-size: 10.5pt; font-weight: 600; margin: 8px 0 1px 0; }
        p, li { margin-bottom: 2px; }
        ul { margin: 2px 0 8px 0; }
    `,
    'two-column': `
        body { font-family: 'Inter', sans-serif; font-size: 11pt; line-height: 1.5; }
        h1 { font-size: 26pt; font-weight: 700; margin: 0 0 6px 0; }
        h2 { font-size: 12pt; font-weight: 700; margin: 16px 0 6px 0; padding-bottom: 3px;
             border-bottom: 2px solid #00805a; text-transform: uppercase; letter-spacing: 0.7px; color: #00805a; }
        h3 { font-size: 11.5pt; font-weight: 600; margin: 10px 0 2px 0; }
    `,
    'photo-header': `
        body { font-family: 'Manrope', sans-serif; font-size: 11pt; line-height: 1.5; }
        h1 { font-size: 30pt; font-weight: 700; margin: 0 0 8px 0; }
        h2 { font-size: 13pt; font-weight: 700; margin: 18px 0 6px 0; padding-bottom: 4px;
             border-bottom: 2px solid #00805a; text-transform: uppercase; letter-spacing: 0.6px; }
        h3 { font-size: 11.5pt; font-weight: 600; margin: 12px 0 2px 0; }
    `,
}

export const renderResumeHTML = ({ contentJson, templateId, fileName }: RenderOpts): string => {
    const bodyHTML = generateHTML(contentJson, renderExtensions)
    const styles = `${baseStyles}\n${templateStyles[templateId] ?? templateStyles['modern']}`

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(fileName ?? 'Resume')}</title>
<style>${styles}</style>
</head>
<body>
<div class="resume-page resume-template-${templateId}">
${bodyHTML}
</div>
</body>
</html>`
}

const escapeHtml = (str: string) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
