import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null

export async function extractQuestionsFromURL(url: string): Promise<string[]> {
  if (!genAI) {
    console.warn('Gemini API key not configured')
    return [
      'Why are you interested in this position?',
      'What are your key qualifications?',
      'What are your salary expectations?',
    ]
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'models/gemini-2.0-flash' })

    const prompt = `You are an assistant that extracts application questions from job postings or scholarship pages.

URL: ${url}

Task: Extract all application questions from this job posting or scholarship page and return them as a JSON array of strings. Only include the questions, nothing else.

Example format: ["Question 1?", "Question 2?", "Question 3?"]

Return only the JSON array:`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const questions = JSON.parse(jsonMatch[0])
      return Array.isArray(questions) ? questions : []
    }
    return []
  } catch (error) {
    console.error('Error extracting questions:', error)
    return []
  }
}

export async function generateAnswer(
  question: string,
  context: {
    resume?: string
    experience?: string
    education?: string
  }
): Promise<string> {
  if (!genAI) {
    return 'AI answer generation is not configured. Please add your Gemini API key to use this feature.'
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'models/gemini-2.0-flash' })

    const prompt = `You are a helpful assistant that generates professional, tailored answers to job and scholarship application questions.

Question: ${question}

Context about the candidate:
${JSON.stringify(context, null, 2)}

Task: Generate a professional, compelling answer to the question above based on the candidate's context. The answer should be:
- Specific and tailored to the candidate's background
- Professional and well-structured
- Between 100-200 words
- Honest and authentic

Answer:`

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

    const prompt = `You are an assistant that extracts structured data from resumes and related documents.

Document content:
${fileContent}

Task:
Return a STRICT JSON object capturing the candidate's profile. Follow EXACTLY this schema:

{
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "field": "string",
      "start_date": "string",
      "end_date": "string",
      "description": "string"
    }
  ],
  "experience": [
    {
      "company": "string",
      "role": "string",
      "start_date": "string",
      "end_date": "string",
      "description": "string"
    }
  ],
  "skills": {
    "technical": ["string"],
    "soft": ["string"],
    "other": ["string"]
  },
  "achievements": ["string"],
  "certifications": [
    {
      "name": "string",
      "issuer": "string",
      "date": "string"
    }
  ],
  "keywords": ["string"],
  "raw_highlights": ["string"]
}

Rules:
- Return ONLY the JSON object.
- Use empty arrays or empty strings when uncertain.
- Do NOT include comments or additional text.`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text().trim()

    const jsonMatch = text.match(/\{[\s\S]*\}$/)
    if (!jsonMatch) {
      return empty
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
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
 * Summarize a document using Gemini based on its filename, extracted text, and/or parsed_data.
 * - Uses models/gemini-2.0-flash
 * - Produces a concise summary (3-5 bullets or a short paragraph) as plain text.
 * - Safe for unknown parsed_data shapes via runtime checks.
 * - Prioritizes extractedText for more accurate summaries.
 */
export async function summarizeDocument(input: {
  fileName: string
  parsedData?: unknown
  extractedText?: string
}): Promise<string> {
  const { fileName, parsedData, extractedText } = input

  if (!genAI) {
    console.warn('Gemini API key not configured for summarizeDocument')
    return `Summary is unavailable because AI is not configured for this deployment. (${fileName})`
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'models/gemini-2.0-flash' })

    let education: unknown
    let experience: unknown
    let skills: unknown
    let achievements: unknown
    let certifications: unknown
    let keywords: unknown
    let raw_highlights: unknown

    if (parsedData && typeof parsedData === 'object') {
      const obj = parsedData as Record<string, unknown>
      if (Array.isArray(obj.education)) education = obj.education
      if (Array.isArray(obj.experience)) experience = obj.experience
      if (obj.skills && typeof obj.skills === 'object') skills = obj.skills
      if (Array.isArray(obj.achievements)) achievements = obj.achievements
      if (Array.isArray(obj.certifications)) certifications = obj.certifications
      if (Array.isArray(obj.keywords)) keywords = obj.keywords
      if (Array.isArray(obj.raw_highlights)) raw_highlights = obj.raw_highlights
    }

    const contextParts: string[] = []

    // Prioritize extracted text for most accurate summary
    if (extractedText && extractedText.trim().length > 0) {
      // Limit text length to avoid token limits (first 3000 chars)
      const truncatedText = extractedText.slice(0, 3000)
      contextParts.push(`Document content:\n${truncatedText}${extractedText.length > 3000 ? '...(truncated)' : ''}`)
    }

    // Include structured data if available
    if (education) {
      contextParts.push(`Education entries:\n${JSON.stringify(education, null, 2)}`)
    }
    if (experience) {
      contextParts.push(`Experience entries:\n${JSON.stringify(experience, null, 2)}`)
    }
    if (skills) {
      contextParts.push(`Skills:\n${JSON.stringify(skills, null, 2)}`)
    }
    if (achievements) {
      contextParts.push(
        `Achievements:\n${JSON.stringify(achievements, null, 2)}`
      )
    }
    if (certifications) {
      contextParts.push(
        `Certifications:\n${JSON.stringify(certifications, null, 2)}`
      )
    }
    if (keywords) {
      contextParts.push(`Keywords:\n${JSON.stringify(keywords, null, 2)}`)
    }
    if (raw_highlights) {
      contextParts.push(
        `Highlights:\n${JSON.stringify(raw_highlights, null, 2)}`
      )
    }

    const contextBlock = contextParts.length
      ? contextParts.join('\n\n')
      : 'No content or structured data is available; infer a generic but helpful summary from the file name only.'

    const prompt = `You are an AI assistant helping summarize user documents (resumes, transcripts, certificates, etc).

File name: ${fileName}

Available context:
${contextBlock}

Task:
- Produce a concise, user-friendly summary of this document.
- Prefer 3-5 bullet points OR a short paragraph (max ~150 words).
- Highlight key qualifications, experience, education, skills, or document purpose.
- If the document content is available, focus on the actual content rather than just metadata.
- Output plain text only (no markdown fences).`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text().trim()

    if (!text) {
      return `Summary could not be generated for "${fileName}".`
    }

    return text
  } catch (error) {
    console.error('Error summarizing document:', error)
    return 'Summary could not be generated due to an internal error.'
  }
}
