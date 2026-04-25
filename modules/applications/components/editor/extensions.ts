import StarterKit from "@tiptap/starter-kit"
import TextAlign from "@tiptap/extension-text-align"
import Placeholder from "@tiptap/extension-placeholder"

// TipTap v3 StarterKit ships bold, italic, underline, strike, link, lists, headings,
// hardBreak, undo/redo, dropcursor, gapcursor. We only add what's missing: TextAlign,
// Placeholder. Keep this lean — extension bloat hurts editor responsiveness.

export const buildExtensions = () => [
    StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
        link: {
            openOnClick: false,
            HTMLAttributes: { class: 'text-blue-600 underline' },
        },
    }),
    TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
    }),
    Placeholder.configure({
        placeholder: ({ node }) => {
            if (node.type.name === 'heading') {
                const level = (node.attrs as { level?: number }).level
                if (level === 1) return 'Your Name'
                if (level === 2) return 'Section Title'
                return 'Subsection'
            }
            return 'Type here…'
        },
    }),
]
