import type { JSONContent } from "@tiptap/core"
import { diffChars } from "diff"
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

interface CanonicalCharacter {
    value: string
    rawIndex: number
    rawEnd: number
}

const canonicalCharacters = (value: string): CanonicalCharacter[] => {
    const output: CanonicalCharacter[] = []
    for (let rawIndex = 0; rawIndex < value.length;) {
        const codePoint = value.codePointAt(rawIndex)
        if (codePoint === undefined) break
        const character = String.fromCodePoint(codePoint)
        const rawEnd = rawIndex + character.length
        const normalized = character
            .toLocaleLowerCase()
            .normalize("NFKD")
            .replace(/[^\p{L}\p{N}]+/gu, "")

        // diffChars indexes UTF-16 code units, so retain one mapping entry for
        // every code unit emitted by normalization.
        for (let index = 0; index < normalized.length; index += 1) {
            output.push({ value: normalized[index], rawIndex, rawEnd })
        }
        rawIndex = rawEnd
    }
    return output
}

const canonicalValue = (characters: CanonicalCharacter[]) =>
    characters.map((character) => character.value).join("")

/**
 * Treat the model output as a layout proposal, not as resume evidence. Character
 * alignment transfers its block and word boundaries onto the original text, so
 * the returned blocks can never contain model-authored claims or altered facts.
 */
export function reconcileGeneratedResumeBlocks(
    source: JSONContent,
    generatedBlocks: EditorBlock[],
): EditorBlock[] | null {
    const sourceText = textFromDocument(source)
    const sourceCharacters = canonicalCharacters(sourceText)
    if (sourceCharacters.length === 0 || generatedBlocks.length === 0) return null

    const generatedLayout = generatedBlocks.map((block) => {
        const characters = canonicalCharacters(block.content)
        return { block, characters, start: 0, end: 0 }
    })
    const generatedCharacters: CanonicalCharacter[] = []
    const generatedSpaceBoundaries = new Set<number>()

    generatedLayout.forEach((layout) => {
        layout.start = generatedCharacters.length
        layout.characters.forEach((character, index) => {
            if (index > 0) {
                const previous = layout.characters[index - 1]
                const between = layout.block.content.slice(previous.rawEnd, character.rawIndex)
                if (/\s/u.test(between)) {
                    generatedSpaceBoundaries.add(generatedCharacters.length)
                }
            }
            generatedCharacters.push(character)
        })
        layout.end = generatedCharacters.length
    })
    if (generatedCharacters.length === 0) return null

    const sourceCanonical = canonicalValue(sourceCharacters)
    const generatedCanonical = canonicalValue(generatedCharacters)
    const generatedToSource = new Array<number>(generatedCanonical.length + 1).fill(0)
    const generatedCharacterSources = new Array<number>(generatedCanonical.length).fill(-1)
    let sourceOffset = 0
    let generatedOffset = 0
    let matchedCharacters = 0

    diffChars(sourceCanonical, generatedCanonical).forEach((part) => {
        const length = part.value.length
        if (part.removed) {
            sourceOffset += length
            generatedToSource[generatedOffset] = sourceOffset
            return
        }
        if (part.added) {
            for (let index = 0; index < length; index += 1) {
                generatedOffset += 1
                generatedToSource[generatedOffset] = sourceOffset
            }
            return
        }

        for (let index = 0; index < length; index += 1) {
            generatedToSource[generatedOffset] = sourceOffset
            generatedCharacterSources[generatedOffset] = sourceOffset
            generatedOffset += 1
            sourceOffset += 1
            matchedCharacters += 1
            generatedToSource[generatedOffset] = sourceOffset
        }
    })
    generatedToSource[generatedCanonical.length] = sourceCharacters.length

    const alignment = matchedCharacters / Math.max(sourceCharacters.length, generatedCharacters.length)
    if (alignment < 0.78) return null

    const rawBoundary = (canonicalOffset: number) => {
        if (canonicalOffset <= 0) return 0
        if (canonicalOffset >= sourceCharacters.length) return sourceText.length
        return sourceCharacters[canonicalOffset].rawIndex
    }
    const sourceSpaceBoundaries = new Set<number>()
    const orderedGeneratedSpaces = [...generatedSpaceBoundaries].sort((left, right) => left - right)
    const anchoredSourceRange = (start: number, end: number) => {
        if (end <= start) return null
        const first = generatedCharacterSources[start]
        if (first < 0) return null
        for (let offset = start; offset < end; offset += 1) {
            if (generatedCharacterSources[offset] !== first + (offset - start)) return null
        }
        return { start: first, end: first + (end - start) }
    }

    orderedGeneratedSpaces.forEach((boundary, boundaryIndex) => {
        const layout = generatedLayout.find((item) => boundary > item.start && boundary < item.end)
        if (!layout) return
        const previousCandidate = orderedGeneratedSpaces[boundaryIndex - 1]
        const nextCandidate = orderedGeneratedSpaces[boundaryIndex + 1]
        const previousSpace = previousCandidate > layout.start ? previousCandidate : undefined
        const nextSpace = nextCandidate < layout.end ? nextCandidate : undefined
        const left = anchoredSourceRange(previousSpace ?? layout.start, boundary)
        const right = anchoredSourceRange(boundary, nextSpace ?? layout.end)
        const mapped = right?.start ?? left?.end ?? -1
        if (mapped > 0 && mapped < sourceCharacters.length) {
            sourceSpaceBoundaries.add(rawBoundary(mapped))
        }
    })

    const rebuildSlice = (start: number, end: number) => {
        let output = ""
        for (let rawIndex = start; rawIndex < end; rawIndex += 1) {
            if (
                sourceSpaceBoundaries.has(rawIndex)
                && output.length > 0
                && !/\s$/u.test(output)
                && !/^\s/u.test(sourceText[rawIndex] ?? "")
            ) {
                output += " "
            }
            output += sourceText[rawIndex]
        }
        return output.trim()
    }

    return generatedLayout
        .map((layout, index): EditorBlock | null => {
            const mappedStart = index === 0 ? 0 : generatedToSource[layout.start]
            const mappedEnd = index === generatedLayout.length - 1
                ? sourceCharacters.length
                : generatedToSource[layout.end]
            if (mappedEnd <= mappedStart) return null

            let content = rebuildSlice(rawBoundary(mappedStart), rawBoundary(mappedEnd))
                .replace(/\s*\|\s*/g, " | ")
                .replace(/\+\s+(?=\d)/g, "+")
            // The list node supplies these presentation markers. Removing them
            // does not remove resume evidence and prevents doubled bullets.
            content = content.replace(/[•●▪◦*]\s*$/u, "").trim()
            if (layout.block.type === "bullet") {
                content = content.replace(/^[•●▪◦*]\s*/u, "").trim()
            }
            if (!content) return null

            return {
                ...layout.block,
                id: `reconciled-${index + 1}`,
                content,
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
    options: { sourceDerived?: boolean } = {},
): { valid: true } | { valid: false; reason: string } {
    const sourceText = textFromDocument(source)
    const repairedText = textFromDocument(repaired)
    const repairedBlocks = collectEditableResumeBlocks(repaired)
    const headings = (repaired.content ?? []).filter((node) => node.type === "heading")

    if (repairedBlocks.length < 5 || headings.length < 2 || resumeNeedsStructuralRepair(repaired)) {
        return { valid: false, reason: "The reconstructed resume did not contain a usable section hierarchy." }
    }

    if (options.sourceDerived) {
        const evidenceCharacters = (value: string) => value.replace(/[\s•●▪◦*]/gu, "")
        if (evidenceCharacters(sourceText) !== evidenceCharacters(repairedText)) {
            return {
                valid: false,
                reason: "The source-derived reconstruction did not preserve the exact evidence characters.",
            }
        }
        return { valid: true }
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
