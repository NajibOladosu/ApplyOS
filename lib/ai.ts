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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `You are an assistant that extracts application questions from job postings or scholarship pages.

URL: ${url}

Task: Extract all application questions from this job posting or scholarship page and return them as a JSON array of strings. Only include the questions, nothing else.

Example format: ["Question 1?", "Question 2?", "Question 3?"]

Return only the JSON array:`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    // Try to extract JSON from the response
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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

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

export async function parseDocument(
  fileContent: string
): Promise<{
  education: string[]
  experience: string[]
  skills: string[]
}> {
  if (!genAI) {
    return {
      education: ['Bachelor of Science in Computer Science'],
      experience: ['Software Engineer at Tech Company'],
      skills: ['JavaScript', 'React', 'Node.js'],
    }
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `You are an assistant that extracts structured data from resumes and documents.

Document content:
${fileContent}

Task: Extract the following information and return it as a JSON object:
- education: array of education entries (e.g., "Bachelor of Science in Computer Science, MIT, 2020")
- experience: array of work experience entries (e.g., "Software Engineer at Google, 2020-2023")
- skills: array of skills (e.g., "JavaScript", "Python", "React")

Return only the JSON object in this exact format:
{
  "education": [],
  "experience": [],
  "skills": []
}`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return { education: [], experience: [], skills: [] }
  } catch (error) {
    console.error('Error parsing document:', error)
    return { education: [], experience: [], skills: [] }
  }
}
