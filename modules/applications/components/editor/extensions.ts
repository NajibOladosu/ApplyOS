import StarterKit from "@tiptap/starter-kit"
import TextAlign from "@tiptap/extension-text-align"
import Placeholder from "@tiptap/extension-placeholder"
import { TextStyle } from "@tiptap/extension-text-style"
import { FontFamily } from "@tiptap/extension-font-family"
import { Extension } from "@tiptap/core"

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        fontSize: {
            setFontSize: (size: string) => ReturnType
            unsetFontSize: () => ReturnType
        }
    }
}

const FontSize = Extension.create({
    name: 'fontSize',
    addOptions() {
        return { types: ['textStyle'] as string[] }
    },
    addGlobalAttributes() {
        return [{
            types: this.options.types,
            attributes: {
                fontSize: {
                    default: null,
                    parseHTML: (element: HTMLElement) => element.style.fontSize?.replace(/['"]+/g, '') || null,
                    renderHTML: (attributes: { fontSize?: string | null }) => {
                        if (!attributes.fontSize) return {}
                        return { style: `font-size: ${attributes.fontSize}` }
                    },
                },
            },
        }]
    },
    addCommands() {
        return {
            setFontSize: (size: string) => ({ chain }: any) =>
                chain().setMark('textStyle', { fontSize: size }).run(),
            unsetFontSize: () => ({ chain }: any) =>
                chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
        }
    },
})

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
    TextStyle,
    FontFamily.configure({ types: ['textStyle'] }),
    FontSize,
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
