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

export interface DocSettings {
    marginTopMm: number
    marginRightMm: number
    marginBottomMm: number
    marginLeftMm: number
}

export const DEFAULT_DOC_SETTINGS: DocSettings = {
    marginTopMm: 20,
    marginRightMm: 20,
    marginBottomMm: 20,
    marginLeftMm: 20,
}

export const FONT_FAMILY_OPTIONS: { label: string; value: string }[] = [
    { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
    { label: 'Manrope', value: 'Manrope, system-ui, sans-serif' },
    { label: 'Helvetica', value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Source Serif', value: '"Source Serif Pro", Georgia, serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
    { label: 'Garamond', value: 'Garamond, serif' },
    { label: 'Courier', value: '"Courier New", Courier, monospace' },
]

export const FONT_SIZE_OPTIONS: string[] = [
    '8pt', '9pt', '10pt', '10.5pt', '11pt', '11.5pt', '12pt', '13pt', '14pt', '16pt', '18pt', '22pt', '26pt', '32pt',
]

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
