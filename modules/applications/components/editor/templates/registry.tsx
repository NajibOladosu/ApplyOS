"use client"

import type { ReactElement } from "react"
import type { Editor } from "@tiptap/react"
import type { TemplateId } from "../types"
import { ModernTemplate } from "./modern"
import { ClassicTemplate } from "./classic"
import { CompactTemplate } from "./compact"
import { TwoColumnTemplate } from "./two-column"
import { PhotoHeaderTemplate } from "./photo-header"

export interface TemplateRendererProps {
    editor: Editor | null
    pageNumber?: number
    totalPages?: number
    photoUrl?: string | null
}

export type TemplateRenderer = (props: TemplateRendererProps) => ReactElement

const renderers: Record<TemplateId, TemplateRenderer> = {
    'modern': (p) => <ModernTemplate {...p} />,
    'classic': (p) => <ClassicTemplate {...p} />,
    'compact': (p) => <CompactTemplate {...p} />,
    'two-column': (p) => <TwoColumnTemplate {...p} />,
    'photo-header': (p) => <PhotoHeaderTemplate {...p} />,
}

export const renderTemplate = (id: TemplateId, props: TemplateRendererProps): ReactElement => {
    const renderer = renderers[id] ?? renderers['modern']
    return renderer(props)
}
