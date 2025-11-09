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

    // Handle markdown code fences
    let jsonText = text
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim()
    }

    const jsonMatch = jsonText.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      try {
        const questions = JSON.parse(jsonMatch[0])
        return Array.isArray(questions) ? questions : []
      } catch (error) {
        console.error('Failed to parse questions JSON:', error)
        return []
      }
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
Produce ONE concise sentence summarizing this document's main purpose and content. Be general and focus on what the document is about.
Output plain text only (no markdown fences, no bullet points, just one sentence).`

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
