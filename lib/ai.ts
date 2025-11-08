import OpenAI from 'openai'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null

export async function extractQuestionsFromURL(url: string): Promise<string[]> {
  if (!openai) {
    console.warn('OpenAI API key not configured')
    return [
      'Why are you interested in this position?',
      'What are your key qualifications?',
      'What are your salary expectations?',
    ]
  }

  try {
    // In production, you'd fetch the URL content here
    // For now, we'll simulate with a prompt
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content:
            'You are an assistant that extracts application questions from job postings or scholarship pages. Return only the questions as a JSON array of strings.',
        },
        {
          role: 'user',
          content: `Extract all application questions from this URL: ${url}. Return them as a JSON array.`,
        },
      ],
      temperature: 0.3,
    })

    const content = response.choices[0].message.content
    if (content) {
      const questions = JSON.parse(content)
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
  if (!openai) {
    return 'AI answer generation is not configured. Please add your OpenAI API key to use this feature.'
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant that generates professional, tailored answers to job and scholarship application questions based on the provided context.',
        },
        {
          role: 'user',
          content: `Question: ${question}\n\nContext:\n${JSON.stringify(context, null, 2)}\n\nGenerate a professional answer:`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    })

    return response.choices[0].message.content || ''
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
  if (!openai) {
    return {
      education: ['Bachelor of Science in Computer Science'],
      experience: ['Software Engineer at Tech Company'],
      skills: ['JavaScript', 'React', 'Node.js'],
    }
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content:
            'You are an assistant that extracts structured data from resumes and documents. Return the data as JSON with keys: education, experience, skills (all arrays).',
        },
        {
          role: 'user',
          content: `Extract education, experience, and skills from this document:\n\n${fileContent}`,
        },
      ],
      temperature: 0.3,
    })

    const content = response.choices[0].message.content
    if (content) {
      return JSON.parse(content)
    }
    return { education: [], experience: [], skills: [] }
  } catch (error) {
    console.error('Error parsing document:', error)
    return { education: [], experience: [], skills: [] }
  }
}
