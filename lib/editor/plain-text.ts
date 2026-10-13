type TipTapNode = {
  type?: string
  text?: string
  content?: TipTapNode[]
}

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "hardBreak",
])

/**
 * Convert stored TipTap JSON into readable text for AI analysis and previews.
 * Formatting marks are intentionally ignored; block boundaries are preserved.
 */
export function tipTapToPlainText(value: unknown): string {
  if (!value || typeof value !== "object") return ""

  const visit = (node: TipTapNode): string => {
    if (node.type === "text") return typeof node.text === "string" ? node.text : ""
    if (node.type === "hardBreak") return "\n"

    const childText = Array.isArray(node.content)
      ? node.content.map(visit).join("")
      : ""

    return BLOCK_TYPES.has(node.type ?? "") ? `${childText}\n` : childText
  }

  return visit(value as TipTapNode)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

type LegacyBlock = { content?: unknown }

/** Convert the legacy block editor representation used by older versions. */
export function legacyBlocksToPlainText(value: unknown): string {
  if (!Array.isArray(value)) return ""
  return value
    .map((block: LegacyBlock) =>
      typeof block?.content === "string" ? block.content.trim() : "",
    )
    .filter(Boolean)
    .join("\n")
}
