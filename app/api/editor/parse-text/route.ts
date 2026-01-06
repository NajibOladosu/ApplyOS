import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callGeminiWithFallback } from "@/lib/ai"

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const { extractedText } = await req.json()

        if (!extractedText) {
            return new NextResponse("Missing extractedText", { status: 400 })
        }

        const prompt = `You are a resume formatting expert. The following text was extracted from a PDF resume (possibly LaTeX-generated), and the formatting is messy.

Your task: Convert this into a clean, structured JSON array of resume blocks that preserves ALL the original content but organizes it properly.

Extracted Text:
${extractedText}

Return ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "blocks": [
    { "type": "h1", "content": "Full Name", "styles": { "align": "center", "bold": true } },
    { "type": "paragraph", "content": "email@example.com | phone | location", "styles": { "align": "center" } },
    { "type": "h2", "content": "Professional Summary", "styles": { "bold": true } },
    { "type": "paragraph", "content": "Summary text here..." },
    { "type": "h2", "content": "Experience", "styles": { "bold": true } },
    { "type": "h3", "content": "Job Title at Company Name", "styles": { "bold": true } },
    { "type": "paragraph", "content": "Jan 2020 - Present | Location", "styles": { "italic": true } },
    { "type": "bullet", "content": "Achievement or responsibility" },
    { "type": "h2", "content": "Education", "styles": { "bold": true } },
    { "type": "paragraph", "content": "Degree - University Name", "styles": { "bold": true } },
    { "type": "h2", "content": "Skills", "styles": { "bold": true } },
    { "type": "paragraph", "content": "Skill1 • Skill2 • Skill3" }
  ]
}

Rules:
- Include ALL content from the original text
- Use "h1" for the person's name
- Use "h2" for section headers (Experience, Education, Skills, etc.)
- Use "h3" for job titles or degree names
- Use "paragraph" for dates, descriptions, or general text
- Use "bullet" for individual achievements/responsibilities
- Preserve the logical order and grouping
- Clean up any garbled text or formatting artifacts
- If contact info is on multiple lines, combine into one paragraph with " | " separators
- Return ONLY the JSON object, nothing else`

        const response = await callGeminiWithFallback(prompt, 'COMPLEX')

        // Parse response
        let jsonText = response
        const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (codeBlockMatch) {
            jsonText = codeBlockMatch[1].trim()
        }

        const jsonMatch = jsonText.match(/\{[\s\S]*\}$/)
        if (!jsonMatch) {
            throw new Error("No valid JSON in response")
        }

        const parsed = JSON.parse(jsonMatch[0])

        return NextResponse.json(parsed)
    } catch (error: any) {
        console.error("AI Parse Error:", error)
        return new NextResponse(error.message || "Internal Server Error", { status: 500 })
    }
}
