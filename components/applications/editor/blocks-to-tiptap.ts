import type { JSONContent } from "@tiptap/react"
import type { EditorBlock, ResumeDoc } from "./types"

const textNode = (content: string, marks: { type: string; attrs?: any }[] = []): JSONContent => ({
    type: 'text',
    text: content,
    ...(marks.length > 0 ? { marks } : {}),
})

const blockMarks = (block: EditorBlock) => {
    const marks: { type: string; attrs?: any }[] = []
    if (block.styles?.bold) marks.push({ type: 'bold' })
    if (block.styles?.italic) marks.push({ type: 'italic' })
    if (block.styles?.underline) marks.push({ type: 'underline' })
    return marks
}

const blockAttrs = (block: EditorBlock) => {
    const attrs: Record<string, unknown> = {}
    if (block.styles?.align && block.styles.align !== 'left') {
        attrs.textAlign = block.styles.align
    }
    return attrs
}

export const blocksToTipTap = (blocks: EditorBlock[]): ResumeDoc => {
    const content: JSONContent[] = []
    let bulletGroup: JSONContent[] | null = null

    const flushBullets = () => {
        if (bulletGroup && bulletGroup.length > 0) {
            content.push({ type: 'bulletList', content: bulletGroup })
        }
        bulletGroup = null
    }

    for (const block of blocks) {
        if (block.type === 'bullet') {
            const item: JSONContent = {
                type: 'listItem',
                content: [{
                    type: 'paragraph',
                    attrs: blockAttrs(block),
                    content: block.content ? [textNode(block.content, blockMarks(block))] : [],
                }],
            }
            if (!bulletGroup) bulletGroup = []
            bulletGroup.push(item)
            continue
        }

        flushBullets()

        if (block.type === 'h1' || block.type === 'h2' || block.type === 'h3') {
            const level = block.type === 'h1' ? 1 : block.type === 'h2' ? 2 : 3
            content.push({
                type: 'heading',
                attrs: { level, ...blockAttrs(block) },
                content: block.content ? [textNode(block.content, blockMarks(block))] : [],
            })
            continue
        }

        content.push({
            type: 'paragraph',
            attrs: blockAttrs(block),
            content: block.content ? [textNode(block.content, blockMarks(block))] : [],
        })
    }

    flushBullets()

    return { type: 'doc', content }
}

export const emptyDoc = (): ResumeDoc => ({
    type: 'doc',
    content: [{ type: 'paragraph' }],
})
