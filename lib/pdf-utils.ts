/**
 * Extract text from PDF files using pdf2json
 *
 * Uses pdf2json which has zero npm dependencies since v3.1.6
 * - Pure JavaScript PDF parsing
 * - No canvas, system binaries, or external tools needed
 * - Works reliably in Node.js API routes
 */

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // pdf2json: zero dependencies, pure JS PDF parsing
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFParser = require("pdf2json")

    return new Promise((resolve, reject) => {
      const parser = new PDFParser()
      let extractedText = ""

      // Extract text from parsed PDF
      parser.on("pdfParser_dataReady", (pdf: any) => {
        try {
          if (pdf && pdf.Pages && Array.isArray(pdf.Pages)) {
            for (const page of pdf.Pages) {
              if (page.Texts && Array.isArray(page.Texts)) {
                for (const textItem of page.Texts) {
                  if (textItem.R && Array.isArray(textItem.R)) {
                    for (const run of textItem.R) {
                      if (run.T) {
                        // Decode URL-encoded text, but handle malformed URIs gracefully
                        try {
                          extractedText += decodeURIComponent(run.T)
                        } catch {
                          // If decoding fails, use the text as-is
                          extractedText += run.T
                        }
                      }
                    }
                  }
                }
              }
              // Add newline between pages
              if (extractedText && extractedText[extractedText.length - 1] !== "\n") {
                extractedText += "\n"
              }
            }
          }

          if (extractedText.trim().length === 0) {
            console.warn("PDF parsing succeeded but returned empty text")
            resolve("")
          } else {
            resolve(extractedText)
          }
        } catch (error) {
          console.error("Error extracting text from parsed PDF:", error)
          reject(error)
        }
      })

      parser.on("pdfParser_dataError", (error: any) => {
        console.error("pdf2json parser error:", error)
        reject(error)
      })

      // Parse the PDF buffer
      try {
        parser.parseBuffer(buffer)
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
