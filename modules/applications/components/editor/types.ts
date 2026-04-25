import type { JSONContent } from "@tiptap/react"

export type TemplateId = 'modern' | 'classic' | 'compact' | 'two-column' | 'photo-header'

export type BlockType = 'h1' | 'h2' | 'h3' | 'paragraph' | 'bullet'

export interface BlockStyles {
    bold?: boolean
    italic?: boolean
    underline?: boolean
    align?: 'left' | 'center' | 'right' | 'justify'
}

export interface EditorBlock {
    id: string
    type: BlockType
    content: string
    styles?: BlockStyles
}

export type ResumeDoc = JSONContent

export interface TemplateMetadata {
    id: TemplateId
    label: string
    description: string
    supportsPhoto: boolean
    supportsSidebar: boolean
    columnCount: 1 | 2
}

export const TEMPLATES: Record<TemplateId, TemplateMetadata> = {
    'modern': {
        id: 'modern',
        label: 'Modern',
        description: 'Clean single-column. Sans-serif. ATS-friendly.',
        supportsPhoto: false,
        supportsSidebar: false,
        columnCount: 1,
    },
    'classic': {
        id: 'classic',
        label: 'Classic',
        description: 'Traditional serif single-column.',
        supportsPhoto: false,
        supportsSidebar: false,
        columnCount: 1,
    },
    'compact': {
        id: 'compact',
        label: 'Compact',
        description: 'Dense single-column. Optimized for one page.',
        supportsPhoto: false,
        supportsSidebar: false,
        columnCount: 1,
    },
    'two-column': {
        id: 'two-column',
        label: 'Two-Column',
        description: 'Sidebar with skills/contact. Body on right.',
        supportsPhoto: false,
        supportsSidebar: true,
        columnCount: 2,
    },
    'photo-header': {
        id: 'photo-header',
        label: 'Photo Header',
        description: 'Avatar + name banner. Single column body.',
        supportsPhoto: true,
        supportsSidebar: false,
        columnCount: 1,
    },
}
