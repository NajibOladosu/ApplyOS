import { GoogleGenerativeAI } from '@google/generative-ai'
import type { DocumentReport } from '@/types/database'

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null

/**
 * NOTE: Question extraction from URLs is now handled by the API route:
 * /api/questions/extract-from-url
 *
 * This route properly scrapes the URL content and passes it to Gemini for analysis.
 * Use that endpoint instead of trying to extract questions client-side.
 */

export async function generateAnswer(
  question: string,
  context: {
    resume?: string
    experience?: string
    education?: string
    jobDescription?: string
  }
): Promise<string> {
  if (!genAI) {
    return 'AI answer generation is not configured. Please add your Gemini API key to use this feature.'
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'models/gemini-2.0-flash' })

    const prompt = `You are helping a candidate answer a job or scholarship application question. Your job is to write the answer AS IF you are the candidate.

Question: ${question}

${context.jobDescription ? `Position/Opportunity Description:\n${context.jobDescription}\n\n` : ''}Candidate's Background:
${context.resume ? `Resume/Profile:\n${context.resume}` : '(No resume provided)'}

Important Instructions:
- Write the answer in first person (as the candidate responding)
- Do NOT provide templates, disclaimers, or bracketed placeholders
- Do NOT say "Here's a template answer" or "Replace X with your own Y"
- Do NOT prefix with explanations or caveats
- Assume all provided information is the candidate's ACTUAL background
- Write a direct, authentic response that the candidate can use
- Make it specific to the candidate's actual experience
- Between 100-200 words
- Professional and compelling

Answer (write as if you are the candidate):`

    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text()
  } catch (error) {
    console.error('Error generating answer:', error)
    return 'Error generating answer. Please try again.'
  }
}

/**
 * Structured analysis shape for documents.
 */
export type ParsedDocument = {
  education: {
    institution: string
    degree: string
    field: string
    start_date: string
    end_date: string
    description: string
  }[]
  experience: {
    company: string
    role: string
    start_date: string
    end_date: string
    description: string
  }[]
  projects: {
    name: string
    description: string
    technologies?: string[]
    start_date?: string
    end_date?: string
  }[]
  skills: {
    technical: string[]
    soft: string[]
    other: string[]
  }
  achievements: string[]
  certifications: {
    name: string
    issuer: string
    date: string
  }[]
  keywords: string[]
  raw_highlights: string[]
}

/**
 * Parse a document into structured data using Gemini.
 * Returns a deterministic ParsedDocument object (never null/undefined, no placeholder noise).
 */
export async function parseDocument(fileContent: string): Promise<ParsedDocument> {
  const empty: ParsedDocument = {
    education: [],
    experience: [],
    projects: [],
    skills: {
      technical: [],
      soft: [],
      other: [],
    },
    achievements: [],
    certifications: [],
    keywords: [],
    raw_highlights: [],
  }

  if (!genAI) {
    return empty
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'models/gemini-2.0-flash' })

    const prompt = `Extract structured information from this resume/document:

${fileContent}

IMPORTANT: Return ONLY valid JSON (no markdown, no code fences, no extra text). Extract EVERYTHING you can find:

{
  "education": [
    {
      "institution": "school/university name",
      "degree": "Bachelor/Master/PhD/Certificate etc",
      "field": "major/subject",
      "start_date": "2020 or 2020-01",
      "end_date": "2024 or 2024-05",
      "description": "relevant coursework or achievements"
    }
  ],
  "experience": [
    {
      "company": "company name",
      "role": "job title",
      "start_date": "2022 or 2022-01",
      "end_date": "2023 or 2023-12",
      "description": "what you did, achievements, impact"
    }
  ],
  "projects": [
    {
      "name": "Project name",
      "description": "What the project does and your role in it",
      "technologies": ["Tech1", "Tech2"],
      "start_date": "2023 or 2023-01",
      "end_date": "2023 or 2023-12"
    }
  ],
  "skills": {
    "technical": ["Python", "JavaScript", "React", etc],
    "soft": ["Leadership", "Communication", etc],
    "other": ["Languages", "Tools", etc]
  },
  "achievements": ["Notable accomplishment 1", "Notable accomplishment 2"],
  "certifications": [
    {
      "name": "Certification name",
      "issuer": "Issuing organization",
      "date": "2023"
    }
  ],
  "keywords": ["Key terms", "Industries", "Technologies"],
  "raw_highlights": ["Bullet point 1", "Bullet point 2"]
}

Rules:
- Return ONLY the JSON object, nothing else
- Include ALL education found
- Include ALL work experience found
- Include ALL projects found (personal, academic, or professional)
- Extract technical AND soft skills
- Use empty arrays [] if section not found
- Use empty strings "" for missing details
- NO markdown, NO code fences, NO explanations`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text().trim()

    // Handle markdown code fences (```json...``` or ```...```)
    let jsonText = text
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim()
    }

    const jsonMatch = jsonText.match(/\{[\s\S]*\}$/)
    if (!jsonMatch) {
      console.warn('No JSON object found in response:', text.substring(0, 100))
      return empty
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch (error) {
      console.error('Failed to parse JSON:', error, 'Text:', jsonMatch[0].substring(0, 100))
      return empty
    }

    if (!parsed || typeof parsed !== 'object') {
      return empty
    }

    const obj = parsed as Record<string, any>

    const normalizeArray = (value: any): string[] =>
      Array.isArray(value) ? value.map((v) => String(v)).filter(Boolean) : []

    const normalized: ParsedDocument = {
      education: Array.isArray(obj.education)
        ? obj.education.map((e: any) => ({
            institution: String(e?.institution || ''),
            degree: String(e?.degree || ''),
            field: String(e?.field || ''),
            start_date: String(e?.start_date || ''),
            end_date: String(e?.end_date || ''),
            description: String(e?.description || ''),
          }))
        : [],
      experience: Array.isArray(obj.experience)
        ? obj.experience.map((e: any) => ({
            company: String(e?.company || ''),
            role: String(e?.role || ''),
            start_date: String(e?.start_date || ''),
            end_date: String(e?.end_date || ''),
            description: String(e?.description || ''),
          }))
        : [],
      projects: Array.isArray(obj.projects)
        ? obj.projects.map((p: any) => ({
            name: String(p?.name || ''),
            description: String(p?.description || ''),
            technologies: normalizeArray(p?.technologies),
            start_date: p?.start_date ? String(p.start_date) : undefined,
            end_date: p?.end_date ? String(p.end_date) : undefined,
          }))
        : [],
      skills: {
        technical: normalizeArray(obj.skills?.technical),
        soft: normalizeArray(obj.skills?.soft),
        other: normalizeArray(obj.skills?.other),
      },
      achievements: normalizeArray(obj.achievements),
      certifications: Array.isArray(obj.certifications)
        ? obj.certifications.map((c: any) => ({
            name: String(c?.name || ''),
            issuer: String(c?.issuer || ''),
            date: String(c?.date || ''),
          }))
        : [],
      keywords: normalizeArray(obj.keywords),
      raw_highlights: normalizeArray(obj.raw_highlights),
    }

    return normalized
  } catch (error) {
    console.error('Error parsing document:', error)
    return empty
  }
}

/**
 * Generate a comprehensive report for a document using Gemini.
 * Analyzes 6 key aspects:
 * 1. Content Quality & Completeness
 * 2. Formatting & Structure
 * 3. ATS Compatibility
 * 4. Language & Clarity
 * 5. Achievement Demonstration
 * 6. Industry Keywords & Relevance
 *
 * Returns a structured DocumentReport with honest feedback (not forcing issues).
 * - Uses models/gemini-2.0-flash
 * - Scores are 1-10 for each category
 * - Improvements only suggested when genuinely needed
 * - Safe for unknown parsed_data shapes via runtime checks
 */
export async function generateDocumentReport(input: {
  fileName: string
  parsedData?: unknown
  extractedText?: string
}): Promise<DocumentReport> {
  const { fileName, parsedData, extractedText } = input

  const defaultReport: DocumentReport = {
    documentType: 'Unknown',
    overallScore: 0,
    overallAssessment: 'Report could not be generated.',
    categories: [],
  }

  if (!genAI) {
    console.warn('Gemini API key not configured for generateDocumentReport')
    defaultReport.overallAssessment =
      'Report generation is unavailable because AI is not configured for this deployment.'
    return defaultReport
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'models/gemini-2.0-flash' })

    let education: unknown
    let experience: unknown
    let projects: unknown
    let skills: unknown
    let achievements: unknown
    let certifications: unknown
    let keywords: unknown
    let raw_highlights: unknown

    if (parsedData && typeof parsedData === 'object') {
      const obj = parsedData as Record<string, unknown>
      if (Array.isArray(obj.education)) education = obj.education
      if (Array.isArray(obj.experience)) experience = obj.experience
      if (Array.isArray(obj.projects)) projects = obj.projects
      if (obj.skills && typeof obj.skills === 'object') skills = obj.skills
      if (Array.isArray(obj.achievements)) achievements = obj.achievements
      if (Array.isArray(obj.certifications)) certifications = obj.certifications
      if (Array.isArray(obj.keywords)) keywords = obj.keywords
      if (Array.isArray(obj.raw_highlights)) raw_highlights = obj.raw_highlights
    }

    const contextParts: string[] = []

    // Prioritize extracted text
    if (extractedText && extractedText.trim().length > 0) {
      const truncatedText = extractedText.slice(0, 4000)
      contextParts.push(`Document content:\n${truncatedText}${extractedText.length > 4000 ? '...(truncated)' : ''}`)
    }

    // Include structured data
    if (education) {
      contextParts.push(`Education entries:\n${JSON.stringify(education, null, 2)}`)
    }
    if (experience) {
      contextParts.push(`Experience entries:\n${JSON.stringify(experience, null, 2)}`)
    }
    if (projects) {
      contextParts.push(`Projects:\n${JSON.stringify(projects, null, 2)}`)
    }
    if (skills) {
      contextParts.push(`Skills:\n${JSON.stringify(skills, null, 2)}`)
    }
    if (achievements) {
      contextParts.push(`Achievements:\n${JSON.stringify(achievements, null, 2)}`)
    }
    if (certifications) {
      contextParts.push(`Certifications:\n${JSON.stringify(certifications, null, 2)}`)
    }
    if (keywords) {
      contextParts.push(`Keywords:\n${JSON.stringify(keywords, null, 2)}`)
    }
    if (raw_highlights) {
      contextParts.push(`Highlights:\n${JSON.stringify(raw_highlights, null, 2)}`)
    }

    const contextBlock = contextParts.length
      ? contextParts.join('\n\n')
      : 'No content or structured data available.'

    const prompt = `You are an expert resume and document reviewer. Analyze the following document and provide a detailed scorecard report.

File name: ${fileName}

Available context:
${contextBlock}

Task: Provide a comprehensive evaluation of this document across 6 key dimensions. Return ONLY valid JSON (no markdown, no code fences, no extra text).

Return JSON with this exact structure:
{
  "documentType": "Resume" or "Cover Letter" or "Transcript" or "Portfolio" or other identified type,
  "overallScore": 7,
  "overallAssessment": "Brief 1-2 sentence overall assessment of document quality",
  "categories": [
    {
      "name": "Content Quality & Completeness",
      "score": 8,
      "strengths": ["Clear description of key achievements", "Relevant experience highlighted"],
      "improvements": ["Consider adding metrics or quantifiable results"]
    },
    {
      "name": "Formatting & Structure",
      "score": 9,
      "strengths": ["Well-organized sections", "Easy to scan"],
      "improvements": []
    },
    {
      "name": "ATS Compatibility",
      "score": 7,
      "strengths": ["Clean formatting", "Standard sections"],
      "improvements": ["Ensure no special characters that may not parse correctly"]
    },
    {
      "name": "Language & Clarity",
      "score": 8,
      "strengths": ["Professional tone", "Clear writing"],
      "improvements": []
    },
    {
      "name": "Achievement Demonstration",
      "score": 7,
      "strengths": ["Shows impact in previous roles"],
      "improvements": ["Add more specific metrics to demonstrate impact"]
    },
    {
      "name": "Industry Keywords & Relevance",
      "score": 8,
      "strengths": ["Relevant technical skills mentioned", "Industry terminology used appropriately"],
      "improvements": []
    }
  ]
}

Scoring Guidelines (1-10):
- 1-3: Needs significant improvement
- 4-6: Below average, has notable gaps
- 7-8: Good, solid performance with minor areas to improve
- 9-10: Excellent, best practices demonstrated

Important Rules:
1. Only include "improvements" if there are genuinely actionable suggestions
2. If a category is strong (score 7+), the improvements array should be empty
3. Be honest - if the document is excellent in a category, don't force feedback
4. Base scores on actual content quality, not appearance alone
5. Achievement Demonstration should rate how well the document shows the person's actual accomplishments
6. Industry Keywords should check for relevant, unique terms (NOT buzzwords or repetition)
7. Return ONLY the JSON object, nothing else`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text().trim()

    // Handle markdown code fences
    let jsonText = text
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim()
    }

    const jsonMatch = jsonText.match(/\{[\s\S]*\}$/)
    if (!jsonMatch) {
      console.warn('No JSON object found in report response')
      return defaultReport
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch (error) {
      console.error('Failed to parse report JSON:', error)
      return defaultReport
    }

    if (!parsed || typeof parsed !== 'object') {
      return defaultReport
    }

    const obj = parsed as Record<string, any>
    const report: DocumentReport = {
      documentType: String(obj.documentType || 'Unknown'),
      overallScore: typeof obj.overallScore === 'number' ? Math.min(10, Math.max(1, obj.overallScore)) : 0,
      overallAssessment: String(obj.overallAssessment || 'Report generated'),
      categories: Array.isArray(obj.categories)
        ? obj.categories
            .map((cat: any) => ({
              name: String(cat?.name || ''),
              score: typeof cat?.score === 'number' ? Math.min(10, Math.max(1, cat.score)) : 0,
              strengths: Array.isArray(cat?.strengths) ? cat.strengths.map((s: any) => String(s)) : [],
              improvements: Array.isArray(cat?.improvements) ? cat.improvements.map((i: any) => String(i)) : [],
            }))
            .filter((cat: any) => cat.name.length > 0)
        : [],
    }

    return report
  } catch (error) {
    console.error('Error generating document report:', error)
    return defaultReport
  }
}

/**
 * @deprecated Use generateDocumentReport instead.
 * Kept for backward compatibility but should not be used in new code.
 */
export async function summarizeDocument(input: {
  fileName: string
  parsedData?: unknown
  extractedText?: string
}): Promise<string> {
  const report = await generateDocumentReport(input)
  return report.overallAssessment
}
