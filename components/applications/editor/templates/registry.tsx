"use client"

import type { Editor } from "@tiptap/react"
import type { TemplateId } from "../types"
import { ModernTemplate } from "./modern"

export interface TemplateRendererProps {
    editor: Editor | null
    pageNumber?: number
    totalPages?: number
}

export type TemplateRenderer = (props: TemplateRendererProps) => JSX.Element

const renderers: Record<TemplateId, TemplateRenderer> = {
    'modern': (p) => <ModernTemplate {...p} />,
    // Phase 4 templates fall back to Modern until implemented:
    'classic': (p) => <ModernTemplate {...p} />,
    'compact': (p) => <ModernTemplate {...p} />,
    'two-column': (p) => <ModernTemplate {...p} />,
    'photo-header': (p) => <ModernTemplate {...p} />,
}

export const renderTemplate = (id: TemplateId, props: TemplateRendererProps): JSX.Element => {
    const renderer = renderers[id] ?? renderers['modern']
    return renderer(props)
}
