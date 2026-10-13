import type { JSONContent } from "@tiptap/core"

export type TailoringMode = "truthful" | "interview-prep"
export type RequirementPriority = "required" | "preferred"
export type EvidenceStatus = "covered" | "partial" | "unsupported"

export interface TailoringRequirement {
    requirement: string
    priority: RequirementPriority
}

export interface RequirementAssessment extends TailoringRequirement {
    status: EvidenceStatus
    evidence: string[]
    evidenceBlockIndexes: number[]
    reason: string
}

export interface ProposedResumeEdit {
    blockIndex: number
    originalText: string
    replacementText: string
    keywordsAdded?: string[]
    reason?: string
}

export interface ResumeTailoringPlan {
    requirements: TailoringRequirement[]
    edits: ProposedResumeEdit[]
    familiaritySkills?: string[]
}

export interface AcceptedResumeEdit extends ProposedResumeEdit {
    reason: string
}

export interface RejectedResumeEdit extends ProposedResumeEdit {
    rejectionReason: string
}

export interface ResumeTailoringReport {
    mode: TailoringMode
    score: number
    requirements: RequirementAssessment[]
    acceptedEdits: AcceptedResumeEdit[]
    rejectedEdits: RejectedResumeEdit[]
    familiaritySkills: string[]
    safety: {
        factsAndMetricsPreserved: boolean
        unsupportedClaimsBlocked: number
        sourceStructurePreserved: boolean
        structureRepaired: boolean
    }
}

export interface TailoredResumeResult {
    contentJson: JSONContent
    report: ResumeTailoringReport
}
