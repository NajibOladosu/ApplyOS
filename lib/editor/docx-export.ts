import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    LevelFormat,
} from "docx"
import type { JSONContent } from "@tiptap/core"

/**
 * Convert TipTap JSON document to a DOCX Buffer.
 * Mapping:
 *   doc.heading[level=1|2|3] -> Paragraph(heading: HEADING_1|2|3)
 *   doc.paragraph             -> Paragraph (normal)
 *   doc.bulletList/listItem   -> Paragraph (numbering: bullet)
 *   doc.orderedList/listItem  -> Paragraph (numbering: decimal)
 *   text marks bold/italic/underline/strike/link -> TextRun props
 */

interface InlineMarks {
    bold?: boolean
    italic?: boolean
    underline?: boolean
    strike?: boolean
    href?: string
}

const collectMarks = (marks: any[] | undefined): InlineMarks => {
    const out: InlineMarks = {}
    if (!marks) return out
    for (const m of marks) {
        if (m.type === 'bold') out.bold = true
        if (m.type === 'italic') out.italic = true
        if (m.type === 'underline') out.underline = true
        if (m.type === 'strike') out.strike = true
        if (m.type === 'link' && m.attrs?.href) out.href = m.attrs.href
    }
    return out
}

const inlineToRuns = (nodes: JSONContent[] | undefined): TextRun[] => {
    if (!nodes || nodes.length === 0) return []
    const runs: TextRun[] = []
    for (const node of nodes) {
        if (node.type === 'text' && typeof node.text === 'string') {
            const marks = collectMarks(node.marks as any[])
            runs.push(new TextRun({
                text: node.text,
                bold: marks.bold,
                italics: marks.italic,
                underline: marks.underline ? {} : undefined,
                strike: marks.strike,
            }))
        } else if (node.type === 'hardBreak') {
            runs.push(new TextRun({ break: 1 }))
        }
    }
    return runs
}

const alignmentFor = (textAlign: string | undefined) => {
    switch (textAlign) {
        case 'center': return AlignmentType.CENTER
        case 'right': return AlignmentType.RIGHT
        case 'justify': return AlignmentType.JUSTIFIED
        default: return AlignmentType.LEFT
    }
}

const headingFor = (level: number) => {
    if (level === 1) return HeadingLevel.HEADING_1
    if (level === 2) return HeadingLevel.HEADING_2
    if (level === 3) return HeadingLevel.HEADING_3
    return undefined
}

const flattenList = (
    node: JSONContent,
    listType: 'bullet' | 'ordered',
    level: number,
    out: Paragraph[],
) => {
    if (!node.content) return
    for (const item of node.content) {
        if (item.type !== 'listItem' || !item.content) continue
        for (const child of item.content) {
            if (child.type === 'paragraph') {
                out.push(new Paragraph({
                    children: inlineToRuns(child.content),
                    alignment: alignmentFor((child.attrs as any)?.textAlign),
                    numbering: { reference: listType === 'bullet' ? 'bullet-list' : 'ordered-list', level },
                }))
            } else if (child.type === 'bulletList') {
                flattenList(child, 'bullet', level + 1, out)
            } else if (child.type === 'orderedList') {
                flattenList(child, 'ordered', level + 1, out)
            }
        }
    }
}

const docNodeToParagraphs = (node: JSONContent): Paragraph[] => {
    if (node.type === 'heading') {
        const level = (node.attrs as any)?.level ?? 2
        return [new Paragraph({
            heading: headingFor(level),
            alignment: alignmentFor((node.attrs as any)?.textAlign),
            children: inlineToRuns(node.content),
        })]
    }
    if (node.type === 'paragraph') {
        return [new Paragraph({
            alignment: alignmentFor((node.attrs as any)?.textAlign),
            children: inlineToRuns(node.content),
        })]
    }
    if (node.type === 'bulletList') {
        const out: Paragraph[] = []
        flattenList(node, 'bullet', 0, out)
        return out
    }
    if (node.type === 'orderedList') {
        const out: Paragraph[] = []
        flattenList(node, 'ordered', 0, out)
        return out
    }
    if (node.type === 'horizontalRule') {
        return [new Paragraph({ border: { bottom: { style: 'single', size: 6, color: '999999', space: 1 } } })]
    }
    return []
}

export async function tiptapToDocxBuffer(json: JSONContent): Promise<Buffer> {
    const paragraphs: Paragraph[] = []
    if (json.type === 'doc' && Array.isArray(json.content)) {
        for (const node of json.content) {
            paragraphs.push(...docNodeToParagraphs(node))
        }
    }

    if (paragraphs.length === 0) {
        paragraphs.push(new Paragraph({ children: [] }))
    }

    const doc = new Document({
        creator: 'ApplyOS',
        title: 'Resume',
        styles: {
            paragraphStyles: [
                {
                    id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { font: 'Calibri', size: 56, bold: true, color: '111111' },
                    paragraph: { spacing: { before: 0, after: 120 } },
                },
                {
                    id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { font: 'Calibri', size: 26, bold: true, color: '111111', allCaps: true },
                    paragraph: { spacing: { before: 280, after: 120 }, border: { bottom: { style: 'single', size: 8, color: 'cccccc', space: 4 } } },
                },
                {
                    id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { font: 'Calibri', size: 23, bold: true, color: '1f2937' },
                    paragraph: { spacing: { before: 200, after: 60 } },
                },
            ],
            default: {
                document: { run: { font: 'Calibri', size: 22 } },
            },
        },
        numbering: {
            config: [
                {
                    reference: 'bullet-list',
                    levels: [
                        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } },
                        { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 240 } } } },
                    ],
                },
                {
                    reference: 'ordered-list',
                    levels: [
                        { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } },
                        { level: 1, format: LevelFormat.LOWER_LETTER, text: '%2.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 240 } } } },
                    ],
                },
            ],
        },
        sections: [{
            properties: {
                page: {
                    margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }, // 20mm in twips
                },
            },
            children: paragraphs,
        }],
    })

    const buffer = await Packer.toBuffer(doc)
    return Buffer.from(buffer)
}
