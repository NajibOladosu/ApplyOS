/**
 * Extract text from PDF files using pdf2json.
 *
 * pdf2json emits positioned text fragments rather than ready-to-use prose. The
 * position-aware reconstruction below is important: concatenating those
 * fragments destroys the spaces and line hierarchy needed by the resume editor.
 */

export interface PdfTextRun {
  T?: string
}

export interface PdfText {
  x?: number
  y?: number
  w?: number
  sw?: number
  R?: PdfTextRun[]
}

export interface PdfPage {
  Texts?: PdfText[]
}

interface PdfParserOutput {
  Pages?: PdfPage[]
}

interface PositionedText {
  text: string
  x?: number
  y?: number
  width?: number
  spaceWidth?: number
  sourceIndex: number
}

interface TextLine {
  y?: number
  items: PositionedText[]
}

const LINE_Y_TOLERANCE = 0.15
const MINIMUM_WORD_GAP = 0.06
// pdf2json reports x/y in form units but text width in pixels (24 per form unit).
const PDF_WIDTH_UNITS_PER_COORDINATE = 24

const decodePdfText = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const textFromItem = (item: PdfText) => (item.R ?? [])
  .map((run) => typeof run.T === "string" ? decodePdfText(run.T) : "")
  .join("")
  .replace(/\u00a0/g, " ")
  .replace(/[ \t]+/g, " ")
  .trim()

const finiteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

const shouldInsertSpace = (previous: PositionedText, current: PositionedText) => {
  if (/\s$/.test(previous.text) || /^\s/.test(current.text)) return false
  if (/^[,.;:!?%)\]}]/.test(current.text)) return false

  if (finiteNumber(previous.x) && finiteNumber(previous.width) && finiteNumber(current.x)) {
    const gap = current.x - (previous.x + previous.width)
    const threshold = Math.max(
      MINIMUM_WORD_GAP,
      finiteNumber(previous.spaceWidth) ? previous.spaceWidth * 0.2 : 0,
    )
    return gap > threshold
  }

  // Positionless fragments are uncommon, but a separating space is much safer
  // than silently joining every word when a producer omitted coordinates.
  return /[\p{L}\p{N}]$/u.test(previous.text) && /^[\p{L}\p{N}]/u.test(current.text)
}

const joinLine = (line: TextLine) => {
  const sorted = [...line.items].sort((left, right) => {
    if (finiteNumber(left.x) && finiteNumber(right.x) && left.x !== right.x) {
      return left.x - right.x
    }
    return left.sourceIndex - right.sourceIndex
  })

  return sorted.reduce((output, item, index) => {
    if (index === 0) return item.text
    return `${output}${shouldInsertSpace(sorted[index - 1], item) ? " " : ""}${item.text}`
  }, "")
}

const median = (values: number[]) => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

const reconstructPage = (page: PdfPage) => {
  const items: PositionedText[] = (page.Texts ?? [])
    .map((item, sourceIndex): PositionedText => ({
      text: textFromItem(item),
      ...(finiteNumber(item.x) ? { x: item.x } : {}),
      ...(finiteNumber(item.y) ? { y: item.y } : {}),
      ...(finiteNumber(item.w) ? { width: item.w / PDF_WIDTH_UNITS_PER_COORDINATE } : {}),
      ...(finiteNumber(item.sw) ? { spaceWidth: item.sw } : {}),
      sourceIndex,
    }))
    .filter((item) => item.text.length > 0)

  const positioned = items
    .filter((item) => finiteNumber(item.y))
    .sort((left, right) => {
      const vertical = (left.y ?? 0) - (right.y ?? 0)
      if (Math.abs(vertical) > LINE_Y_TOLERANCE) return vertical
      if (finiteNumber(left.x) && finiteNumber(right.x)) return left.x - right.x
      return left.sourceIndex - right.sourceIndex
    })
  const positionless = items.filter((item) => !finiteNumber(item.y))
  const lines: TextLine[] = []

  positioned.forEach((item) => {
    const currentLine = lines[lines.length - 1]
    if (
      currentLine
      && finiteNumber(currentLine.y)
      && finiteNumber(item.y)
      && Math.abs(item.y - currentLine.y) <= LINE_Y_TOLERANCE
    ) {
      currentLine.items.push(item)
      currentLine.y = (currentLine.y * (currentLine.items.length - 1) + item.y) / currentLine.items.length
    } else {
      lines.push({ y: item.y, items: [item] })
    }
  })

  // Keep coordinate-free fragments readable instead of reverting to the old
  // concatenation behaviour. Their original order is the only signal available.
  if (positionless.length > 0) {
    lines.push({ items: positionless.sort((a, b) => a.sourceIndex - b.sourceIndex) })
  }

  const verticalGaps = lines
    .slice(1)
    .map((line, index) => finiteNumber(line.y) && finiteNumber(lines[index].y)
      ? line.y - lines[index].y
      : 0)
    .filter((gap) => gap > LINE_Y_TOLERANCE)
  const normalLineGap = median(verticalGaps)

  return lines.reduce((output, line, index) => {
    const text = joinLine(line)
    if (!text) return output
    if (index === 0 || !output) return text

    const previous = lines[index - 1]
    const gap = finiteNumber(line.y) && finiteNumber(previous.y) ? line.y - previous.y : 0
    const hasSectionGap = normalLineGap > 0 && gap > normalLineGap * 1.55
    return `${output}${hasSectionGap ? "\n\n" : "\n"}${text}`
  }, "")
}

/**
 * Reconstruct readable text from pdf2json page data. Exported separately so the
 * spacing and line heuristics can be covered without parsing a binary fixture.
 */
export function reconstructTextFromPdfPages(pages: PdfPage[]): string {
  return pages
    .map(reconstructPage)
    .filter(Boolean)
    .join("\n\n")
    .trim()
}

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // pdf2json: zero dependencies, pure JS PDF parsing
    const PDFParser = (await import("pdf2json")).default

    return new Promise((resolve, reject) => {
      const parser = new PDFParser()

      parser.on("pdfParser_dataReady", (pdf: PdfParserOutput) => {
        try {
          const extractedText = Array.isArray(pdf?.Pages)
            ? reconstructTextFromPdfPages(pdf.Pages)
            : ""

          if (extractedText.length === 0) {
            console.warn("PDF parsing succeeded but returned empty text")
          }
          resolve(extractedText)
        } catch (error) {
          console.error("Error extracting text from parsed PDF:", error)
          reject(error)
        }
      })

      parser.on("pdfParser_dataError", (error: unknown) => {
        console.error("pdf2json parser error:", error)
        // Resolve with empty string on parse errors so callers get a graceful
        // fallback instead of an unhandled rejection (e.g. garbage buffers).
        resolve("")
      })

      // pdf2json v4 can read from offset 0 of a pooled buffer's backing store.
      // Ensure the parser receives an isolated ArrayBuffer beginning at byte 0.
      let parsableBuffer = buffer
      if (buffer.buffer.byteLength !== buffer.byteLength) {
        parsableBuffer = Buffer.allocUnsafeSlow(buffer.length)
        buffer.copy(parsableBuffer)
      }
      try {
        parser.parseBuffer(parsableBuffer)
      } catch (error) {
        console.error("Error parsing PDF buffer:", error)
        reject(error)
      }
    })
  } catch (error) {
    console.error("PDF text extraction failed:", error)
    // Return empty string on failure - AI will work with parsed_data if available
    return ""
  }
}
