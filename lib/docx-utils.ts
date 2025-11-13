/**
 * Extract text from DOCX files using mammoth
 *
 * Mammoth is a pure JavaScript DOCX parser with minimal dependencies
 * - Extracts text and basic formatting from Word documents
 * - No canvas, system binaries, or external tools needed
 * - Works reliably in Node.js API routes
 */

import mammoth from "mammoth"

export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer })

    if (!result.value || result.value.trim().length === 0) {
      console.warn("DOCX parsing succeeded but returned empty text")
      return ""
    }

    // Limit extracted text to 100KB to avoid overwhelming AI processing
    const MAX_TEXT_LENGTH = 100 * 1024
    const extractedText = result.value.slice(0, MAX_TEXT_LENGTH)

    if (result.messages && result.messages.length > 0) {
      console.warn("DOCX extraction warnings:", result.messages)
    }

    return extractedText
  } catch (error) {
    console.error("DOCX text extraction failed:", error)
    // Return empty string on failure - AI will work with parsed_data if available
    return ""
  }
}
