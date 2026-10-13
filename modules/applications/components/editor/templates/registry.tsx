"use client"

import type { ReactElement } from "react"
import type { Editor } from "@tiptap/react"
import type { DocSettings, TemplateId } from "../types"
import { AtsTemplate } from "./ats"
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
    docSettings?: DocSettings
}

export type TemplateRenderer = (props: TemplateRendererProps) => ReactElement

const renderers: Record<TemplateId, TemplateRenderer> = {
    'ats': (p) => <AtsTemplate {...p} />,
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
