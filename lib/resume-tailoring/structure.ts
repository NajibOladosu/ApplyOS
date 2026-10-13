import type { JSONContent } from "@tiptap/core"
import type { EditorBlock } from "@/modules/applications/components/editor/types"
import { collectEditableResumeBlocks } from "./engine"

const ALLOWED_BLOCK_TYPES = new Set<EditorBlock["type"]>([
    "h1",
    "h2",
    "h3",
    "paragraph",
    "bullet",
])

const textFromDocument = (doc: JSONContent) =>
    collectEditableResumeBlocks(doc).map((block) => block.text).join("\n")

export function resumeNeedsStructuralRepair(doc: JSONContent): boolean {
    const blocks = collectEditableResumeBlocks(doc)
    const totalCharacters = blocks.reduce((sum, block) => sum + block.text.length, 0)
    const longestBlock = blocks.reduce((longest, block) => Math.max(longest, block.text.length), 0)
    const topLevelHeadings = (doc.content ?? []).filter((node) => node.type === "heading").length
    const listCount = (doc.content ?? []).filter((node) =>
        node.type === "bulletList" || node.type === "orderedList"
    ).length

    if (totalCharacters < 400) return false
    return blocks.length < 5
        || topLevelHeadings < 2
        || longestBlock / totalCharacters > 0.55
        || (totalCharacters > 1200 && listCount === 0)
}

const STANDARD_SECTION_NAMES = new Set([
    "summary",
    "professional summary",
    "profile",
    "experience",
    "work experience",
    "professional experience",
    "projects",
    "skills",
    "technical skills",
    "education",
    "certifications",
    "awards",
    "publications",
    "volunteering",
    "languages",
    "interests",
])

/** Preserve extracted line boundaries even when the AI formatter is unavailable. */
export function resumeBlocksFromTextLines(text: string): EditorBlock[] {
    const extractedLines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    // Keep pathological inputs from creating thousands of editor nodes without
    // discarding text: coalesce any overflow into a final paragraph.
    const lines = extractedLines.length > 500
        ? [...extractedLines.slice(0, 499), extractedLines.slice(499).join(" ")]
        : extractedLines

    return lines.map((line, index) => {
        const withoutBullet = line.replace(/^[•●▪◦*-]\s*/, "").trim()
        const normalized = withoutBullet.replace(/:$/, "").trim().toLocaleLowerCase()
        const isSection = STANDARD_SECTION_NAMES.has(normalized)
            || (/^[A-Z][A-Z\s/&-]{2,40}:?$/.test(line) && line.split(/\s+/).length <= 5)
        const isBullet = withoutBullet !== line

        return {
            id: `extracted-${index + 1}`,
            type: index === 0 ? "h1" : isSection ? "h2" : isBullet ? "bullet" : "paragraph",
            content: isBullet ? withoutBullet : line,
            styles: {
                ...(index === 0 || isSection ? { bold: true } : {}),
                ...(index === 0 ? { align: "center" as const } : {}),
            },
        }
    })
}

export function normalizeGeneratedResumeBlocks(value: unknown): EditorBlock[] {
    if (!Array.isArray(value)) return []

    return value
        .slice(0, 160)
        .map((candidate, index): EditorBlock | null => {
            if (!candidate || typeof candidate !== "object") return null
            const item = candidate as {
                type?: unknown
                content?: unknown
                styles?: {
                    bold?: unknown
                    italic?: unknown
                    underline?: unknown
                    align?: unknown
                }
            }
            if (typeof item.type !== "string" || !ALLOWED_BLOCK_TYPES.has(item.type as EditorBlock["type"])) {
                return null
            }
            const content = typeof item.content === "string"
                ? item.content.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim()
                : ""
            if (!content) return null

            const align = ["left", "center", "right", "justify"].includes(String(item.styles?.align))
                ? item.styles?.align as "left" | "center" | "right" | "justify"
                : undefined
            return {
                id: `repaired-${index + 1}`,
                type: item.type as EditorBlock["type"],
                content,
                styles: {
                    ...(item.styles?.bold === true ? { bold: true } : {}),
                    ...(item.styles?.italic === true ? { italic: true } : {}),
                    ...(item.styles?.underline === true ? { underline: true } : {}),
                    ...(align ? { align } : {}),
                },
            }
        })
        .filter((block): block is EditorBlock => Boolean(block))
}

const compactForComparison = (value: string) => value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "")

const countMatches = (value: string, pattern: RegExp) => value.match(pattern)?.length ?? 0

const domainFacts = (value: string) => new Set(
    (value.match(/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|io|dev|ai|co|ng|edu|gov|me|app)/gi) ?? [])
        .map((fact) => compactForComparison(fact)),
)

const explicitContacts = (value: string) => [
    ...(value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []),
    ...(value.match(/(?:https?:\/\/|www\.)[^\s|]+/gi) ?? []),
].map((fact) => fact.toLocaleLowerCase().replace(/\s/g, "")).filter(Boolean)

const numericFacts = (value: string) => (
    value.match(/(?:[$£€₦]\s*)?\+?\d(?:[\d\s.,:/–—-]*\d)?(?:\s*(?:%|x|[kmb]))?/gi) ?? []
).map((fact) => fact.replace(/\s/g, "").toLocaleLowerCase())

const factualFingerprintsMatch = (source: string, repaired: string) => {
    // Numeric token fingerprints allow harmless restoration of spaces in dates
    // and phone numbers while preserving decimal points, signs, ranges, currency,
    // suffixes, order, and every digit.
    if (JSON.stringify(numericFacts(source)) !== JSON.stringify(numericFacts(repaired))) return false
    if (countMatches(source, /@/g) !== countMatches(repaired, /@/g)) return false
    if (countMatches(source, /[%$£€₦]/g) !== countMatches(repaired, /[%$£€₦]/g)) return false

    const sourceDomains = domainFacts(source)
    const repairedDomains = domainFacts(repaired)
    if (
        [...sourceDomains].some((domain) => !repairedDomains.has(domain))
        || [...repairedDomains].some((domain) => !sourceDomains.has(domain))
    ) return false

    const whitespaceFreeSource = source.toLocaleLowerCase().replace(/\s/g, "")
    // Contacts in a flattened source can absorb an adjacent name or heading.
    // Requiring every repaired contact to occur verbatim in the source protects
    // punctuation too, without rejecting the safe insertion of a boundary.
    return explicitContacts(repaired).every((fact) => whitespaceFreeSource.includes(fact))
}

export function validateStructuralRepair(
    source: JSONContent,
    repaired: JSONContent,
): { valid: true } | { valid: false; reason: string } {
    const sourceText = textFromDocument(source)
    const repairedText = textFromDocument(repaired)
    const repairedBlocks = collectEditableResumeBlocks(repaired)
    const headings = (repaired.content ?? []).filter((node) => node.type === "heading")

    if (repairedBlocks.length < 5 || headings.length < 2 || resumeNeedsStructuralRepair(repaired)) {
        return { valid: false, reason: "The reconstructed resume did not contain a usable section hierarchy." }
    }

    const sourceCompact = compactForComparison(sourceText)
    const repairedCompact = compactForComparison(repairedText)
    if (repairedCompact.length < sourceCompact.length * 0.72) {
        return { valid: false, reason: "The reconstructed resume omitted too much source content." }
    }
    if (repairedCompact.length > sourceCompact.length * 1.18) {
        return { valid: false, reason: "The reconstructed resume introduced too much new content." }
    }

    if (!factualFingerprintsMatch(sourceText, repairedText)) {
        return { valid: false, reason: "The reconstructed resume added, changed, or removed a protected factual value." }
    }
    if (sourceCompact !== repairedCompact) {
        return { valid: false, reason: "The reconstructed resume changed the source wording or order." }
    }

    return { valid: true }
}
