import type { JSONContent } from "@tiptap/core"
import type {
    AcceptedResumeEdit,
    EvidenceStatus,
    ProposedResumeEdit,
    RejectedResumeEdit,
    RequirementAssessment,
    ResumeTailoringPlan,
    TailoredResumeResult,
    TailoringMode,
    TailoringRequirement,
} from "./types"

export interface EditableResumeBlock {
    blockIndex: number
    path: number[]
    type: string
    text: string
}

const PREFERRED_WEIGHT = 0.4
const PARTIAL_WEIGHT = 0.5

// These are well-known naming variants, not inferred qualifications. They only
// allow a requirement to match wording that is already present in the resume.
const TERM_EQUIVALENTS: string[][] = [
    ["amazon web services", "aws"],
    ["google cloud platform", "google cloud", "gcp"],
    ["javascript", "js"],
    ["kubernetes", "k8s"],
    ["node.js", "nodejs", "node js"],
    ["postgresql", "postgres"],
    ["rest api", "restful api", "rest apis", "restful apis"],
    ["typescript", "ts"],
]

const normalize = (value: string) => value
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const unique = <T>(values: T[]) => [...new Set(values)]

const aliasesFor = (value: string) => {
    const normalized = normalize(value)
    const group = TERM_EQUIVALENTS.find((items) => items.some((item) => normalize(item) === normalized))
    return group ? unique([value, ...group]) : [value]
}

const containsPhrase = (text: string, phrase: string) => {
    const haystack = ` ${normalize(text)} `
    const needle = normalize(phrase)
    return needle.length > 1 && haystack.includes(` ${needle} `)
}

const textFromNode = (node: JSONContent): string => {
    if (node.type === "text") return node.text ?? ""
    return (node.content ?? []).map(textFromNode).join(node.type === "hardBreak" ? "\n" : "")
}

export function collectEditableResumeBlocks(doc: JSONContent): EditableResumeBlock[] {
    const blocks: EditableResumeBlock[] = []

    const visit = (node: JSONContent, path: number[]) => {
        if (node.type === "paragraph" || node.type === "heading") {
            const text = textFromNode(node).replace(/\s+/g, " ").trim()
            if (text) {
                blocks.push({
                    blockIndex: blocks.length,
                    path,
                    type: node.type,
                    text,
                })
            }
            return
        }
        node.content?.forEach((child, index) => visit(child, [...path, index]))
    }

    visit(doc, [])
    return blocks
}

const requirementParts = (requirement: string): { operator: "and" | "or"; terms: string[] } => {
    const slashParts = requirement.split("/").map((part) => part.trim()).filter(Boolean)
    if (slashParts.length > 1) return { operator: "or", terms: slashParts }

    const orParts = requirement.split(/\s+(?:or|either)\s+/i).map((part) => part.trim()).filter(Boolean)
    if (orParts.length > 1) return { operator: "or", terms: orParts }

    const andParts = requirement.split(/\s+and\s+/i).map((part) => part.trim()).filter(Boolean)
    if (andParts.length > 1 && andParts.length <= 4) return { operator: "and", terms: andParts }

    return { operator: "or", terms: [requirement] }
}

const evidenceForTerm = (term: string, blocks: EditableResumeBlock[]) => {
    const aliases = aliasesFor(term)
    return blocks.filter((block) => aliases.some((alias) => containsPhrase(block.text, alias)))
}

export function assessRequirementEvidence(
    requirements: TailoringRequirement[],
    blocks: EditableResumeBlock[],
): RequirementAssessment[] {
    const seen = new Set<string>()
    const assessments: RequirementAssessment[] = []

    for (const item of requirements) {
        const requirement = item.requirement?.trim()
        const priority = item.priority === "preferred" ? "preferred" : "required"
        const key = `${priority}:${normalize(requirement)}`
        if (!requirement || seen.has(key)) continue
        seen.add(key)

        const { operator, terms } = requirementParts(requirement)
        const matches = terms.map((term) => evidenceForTerm(term, blocks))
        const matchedTermCount = matches.filter((items) => items.length > 0).length
        let status: EvidenceStatus = "unsupported"
        if (operator === "or" && matchedTermCount > 0) status = "covered"
        if (operator === "and" && matchedTermCount === terms.length) status = "covered"
        if (operator === "and" && matchedTermCount > 0 && matchedTermCount < terms.length) status = "partial"

        const evidenceBlocks = unique(matches.flat().map((match) => match.blockIndex))
        const evidence = evidenceBlocks
            .map((blockIndex) => blocks.find((block) => block.blockIndex === blockIndex)?.text)
            .filter((value): value is string => Boolean(value))
            .slice(0, 3)

        assessments.push({
            requirement,
            priority,
            status,
            evidence,
            evidenceBlockIndexes: evidenceBlocks.slice(0, 3),
            reason: status === "covered"
                ? "The selected resume version contains direct or equivalent evidence."
                : status === "partial"
                    ? "The resume supports part, but not all, of this combined requirement."
                    : "No direct evidence was found in the selected resume version.",
        })
    }

    return assessments
}

export function calculateEvidenceScore(assessments: RequirementAssessment[]): number {
    const total = assessments.reduce(
        (sum, item) => sum + (item.priority === "required" ? 1 : PREFERRED_WEIGHT),
        0,
    )
    if (total === 0) return 0

    const earned = assessments.reduce((sum, item) => {
        const priorityWeight = item.priority === "required" ? 1 : PREFERRED_WEIGHT
        const evidenceWeight = item.status === "covered" ? 1 : item.status === "partial" ? PARTIAL_WEIGHT : 0
        return sum + priorityWeight * evidenceWeight
    }, 0)

    return Math.round((earned / total) * 100)
}

const metricTokens = (value: string) => unique(
    value.match(/(?:[$£€₦]\s*)?\d[\d,.]*(?:%|x|k|m|b)?/gi) ?? [],
).map((token) => token.toLocaleLowerCase().replace(/\s+/g, ""))

const preservesMetrics = (original: string, replacement: string) => {
    const before = metricTokens(original)
    const after = metricTokens(replacement)
    return before.every((token) => after.includes(token))
        && after.every((token) => before.includes(token))
}

const isProtectedBlock = (block: EditableResumeBlock) => {
    if (block.type === "heading" && block.path.length === 1) {
        // A top-level heading may be a name (h1) or a section label. Section
        // labels should not be rewritten by the tailoring model.
        return true
    }
    return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(block.text)
        || /(?:\+?\d[\d\s().-]{7,}\d)/.test(block.text)
}

const assessmentForKeyword = (
    keyword: string,
    assessments: RequirementAssessment[],
) => assessments.find((assessment) => {
    if (normalize(assessment.requirement) === normalize(keyword)) return true
    return aliasesFor(assessment.requirement).some((alias) => normalize(alias) === normalize(keyword))
})

const unsupportedRequirementIntroduced = (
    original: string,
    replacement: string,
    assessments: RequirementAssessment[],
) => assessments.some((assessment) =>
    assessment.status === "unsupported"
    && !containsPhrase(original, assessment.requirement)
    && containsPhrase(replacement, assessment.requirement)
)

const editRejectionReason = (
    edit: ProposedResumeEdit,
    block: EditableResumeBlock | undefined,
    assessments: RequirementAssessment[],
): string | null => {
    if (!block) return "The proposed block does not exist in the source resume."
    if (normalize(edit.originalText) !== normalize(block.text)) {
        return "The proposal did not match the exact source block."
    }
    const replacement = edit.replacementText?.trim()
    if (!replacement) return "The proposal would remove source content."
    if (isProtectedBlock(block)) return "Contact details and section labels are protected."
    if (!preservesMetrics(block.text, replacement)) {
        return "The proposal changed, removed, or introduced a numeric fact."
    }

    const originalWords = Math.max(1, block.text.split(/\s+/).length)
    const replacementWords = replacement.split(/\s+/).length
    if (replacementWords < Math.max(3, Math.floor(originalWords * 0.55))) {
        return "The proposal removed too much of the original evidence."
    }
    if (replacementWords > Math.ceil(originalWords * 1.22) + 2) {
        return "The proposal exceeded the layout-safe word budget."
    }

    if (unsupportedRequirementIntroduced(block.text, replacement, assessments)) {
        return "The proposal introduced a job requirement with no resume evidence."
    }

    for (const keyword of edit.keywordsAdded ?? []) {
        const assessment = assessmentForKeyword(keyword, assessments)
        const evidencedElsewhere = assessment?.status === "covered" || assessment?.status === "partial"
        const alreadyInBlock = aliasesFor(keyword).some((alias) => containsPhrase(block.text, alias))
        if (!evidencedElsewhere && !alreadyInBlock) {
            return `The added keyword “${keyword}” is not supported by the source resume.`
        }
    }

    return null
}

const nodeAtPath = (doc: JSONContent, path: number[]) => {
    let cursor: JSONContent | undefined = doc
    for (const index of path) cursor = cursor?.content?.[index]
    return cursor
}

const replaceBlockText = (doc: JSONContent, block: EditableResumeBlock, replacement: string) => {
    const node = nodeAtPath(doc, block.path)
    if (!node) return
    const firstText = node.content?.find((child) => child.type === "text")
    const safeMarks = (firstText?.marks ?? []).filter((mark) => mark.type !== "textStyle")
    node.content = [{
        type: "text",
        text: replacement,
        ...(safeMarks.length > 0 ? { marks: safeMarks } : {}),
    }]
}

const removeInlineLayoutMarks = (node: JSONContent) => {
    if (node.marks) node.marks = node.marks.filter((mark) => mark.type !== "textStyle")
    node.content?.forEach(removeInlineLayoutMarks)
}

const appendFamiliaritySection = (doc: JSONContent, skills: string[]) => {
    if (skills.length === 0) return
    if (!doc.content) doc.content = []
    doc.content.push(
        {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Familiarity" }],
        },
        {
            type: "paragraph",
            content: [{
                type: "text",
                text: skills.map((skill) => `${skill} (familiarity)`).join(" • "),
            }],
        },
    )
}

const safeFamiliaritySkills = (
    requested: string[],
    mode: TailoringMode,
    assessments: RequirementAssessment[],
) => {
    if (mode !== "interview-prep") return []
    const unsupported = assessments.filter((item) => item.status === "unsupported")
    return unique(requested.map((skill) => skill.trim()).filter((skill) => {
        if (!skill) return false
        return unsupported.some((item) =>
            normalize(item.requirement) === normalize(skill)
            || item.requirement.split(/[/,]/).some((part) => normalize(part) === normalize(skill))
        )
    })).slice(0, 8)
}

export function applyEvidenceLedTailoring(
    source: JSONContent,
    plan: ResumeTailoringPlan,
    mode: TailoringMode,
): TailoredResumeResult {
    const blocks = collectEditableResumeBlocks(source)
    const assessments = assessRequirementEvidence(plan.requirements ?? [], blocks)
    const output = JSON.parse(JSON.stringify(source)) as JSONContent
    const acceptedEdits: AcceptedResumeEdit[] = []
    const rejectedEdits: RejectedResumeEdit[] = []

    const seenBlocks = new Set<number>()
    for (const edit of plan.edits ?? []) {
        const block = blocks.find((candidate) => candidate.blockIndex === edit.blockIndex)
        let rejectionReason = seenBlocks.has(edit.blockIndex)
            ? "Only one proposal is allowed per source block."
            : editRejectionReason(edit, block, assessments)

        if (!rejectionReason && mode === "truthful" && unsupportedRequirementIntroduced(
            edit.originalText,
            edit.replacementText,
            assessments,
        )) {
            rejectionReason = "Truthful mode blocked an unsupported claim."
        }

        if (rejectionReason || !block) {
            rejectedEdits.push({ ...edit, rejectionReason: rejectionReason ?? "Invalid proposal." })
            continue
        }

        seenBlocks.add(edit.blockIndex)
        replaceBlockText(output, block, edit.replacementText.trim())
        acceptedEdits.push({
            ...edit,
            replacementText: edit.replacementText.trim(),
            reason: edit.reason?.trim() || "Improves relevance while preserving the source evidence.",
        })
    }

    removeInlineLayoutMarks(output)
    const familiaritySkills = safeFamiliaritySkills(
        plan.familiaritySkills ?? [],
        mode,
        assessments,
    )
    appendFamiliaritySection(output, familiaritySkills)

    return {
        contentJson: output,
        report: {
            mode,
            score: calculateEvidenceScore(assessments),
            requirements: assessments,
            acceptedEdits,
            rejectedEdits,
            familiaritySkills,
            safety: {
                factsAndMetricsPreserved: true,
                unsupportedClaimsBlocked: rejectedEdits.filter((edit) =>
                    edit.rejectionReason.includes("unsupported")
                    || edit.rejectionReason.includes("not supported")
                    || edit.rejectionReason.includes("no resume evidence")
                ).length,
                sourceStructurePreserved: familiaritySkills.length === 0,
                structureRepaired: false,
            },
        },
    }
}
