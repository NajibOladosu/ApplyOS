import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null

/**
 * Extract text content from HTML
 * Removes script, style tags and extracts readable text
 */
function extractTextFromHTML(html: string): string {
  try {
    // Remove script and style tags with their content
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

    // Remove HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, '')

    // Remove HTML tags but keep the content
    text = text.replace(/<[^>]+>/g, ' ')

    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ')
    text = text.replace(/&amp;/g, '&')
    text = text.replace(/&lt;/g, '<')
    text = text.replace(/&gt;/g, '>')
    text = text.replace(/&quot;/g, '"')
    text = text.replace(/&#39;/g, "'")

    // Clean up whitespace
    text = text.replace(/\s+/g, ' ')
    text = text.trim()

    return text
  } catch (error) {
    console.error('Error extracting text from HTML:', error)
    return html
  }
}

/**
 * POST /api/questions/extract-from-url
 *
 * Extracts application questions from a job/scholarship posting URL
 *
 * Request body:
 * {
 *   "url": "https://example.com/job-posting"
 * }
 *
 * Response:
 * {
 *   "questions": ["Question 1?", "Question 2?", ...]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if Gemini AI is configured
    if (!genAI) {
      return NextResponse.json(
        {
          error: 'AI service not configured. Please add Gemini API key to enable question extraction.',
          questions: [],
        },
        { status: 200 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate URL format
    let validUrl: URL
    try {
      validUrl = new URL(url)
      if (!validUrl.protocol.startsWith('http')) {
        throw new Error('Invalid protocol')
      }
    } catch (error) {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    // Fetch the URL content
    let htmlContent: string
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        // Set a timeout
        signal: AbortSignal.timeout(10000), // 10 seconds
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('text/html')) {
        return NextResponse.json(
          { error: 'URL does not point to an HTML page' },
          { status: 400 }
        )
      }

      htmlContent = await response.text()
    } catch (error) {
      console.error('Error fetching URL:', error)
      return NextResponse.json(
        {
          error: 'Failed to fetch URL content. The page may be protected or inaccessible. Please check the URL or add questions manually.',
          questions: [],
        },
        { status: 200 } // Return 200 with empty array instead of failing
      )
    }

    // Extract text from HTML
    const textContent = extractTextFromHTML(htmlContent)

    if (!textContent || textContent.length < 50) {
      return NextResponse.json(
        {
          error: 'Could not extract meaningful content from the URL. The page may be empty or use JavaScript rendering.',
          questions: [],
        },
        { status: 200 }
      )
    }

    // Limit text length to avoid token limits (use first 8000 characters)
    const truncatedText = textContent.slice(0, 8000)

    // Use Gemini to extract questions
    try {
      const model = genAI.getGenerativeModel({ model: 'models/gemini-2.0-flash' })

      const prompt = `You are an AI assistant that extracts open-ended application questions from job postings and scholarship pages.

Below is the text content extracted from a job/scholarship posting webpage:

${truncatedText}

CRITICAL RULES:
1. ONLY extract questions that are LITERALLY WRITTEN on the page - do NOT make up, invent, or hallucinate any questions
2. Copy the EXACT WORDING from the page - do not paraphrase or rewrite
3. Extract ALL open-ended questions that require written text responses (paragraphs, not just single words)
4. If you don't see any open-ended questions on the page, return an empty array []

WHAT IS AN OPEN-ENDED QUESTION?
Any question that requires the applicant to write at least a few sentences explaining their thoughts, experiences, or perspectives. This includes:
- "Why" questions (Why are you interested? Why do you want to work here?)
- "What" questions about experiences, motivations, or perspectives
- "How" questions about approaches or methods
- "Describe" or "Tell us about" prompts
- Questions asking for examples, stories, or explanations
- Questions about goals, challenges, interests, or opinions
- Cover letter or personal statement prompts

EXCLUDE ONLY these basic form fields (NOT open-ended):
- Personal information: name, preferred name, pronouns, name pronunciation
- Contact details: email, phone, address, city, state, country, zip code
- Links to files: resume, portfolio, GitHub, LinkedIn, website URLs
- Education factual data: university name, major, graduation date, GPA, degree type
- Simple factual questions with one-word answers: "What languages do you speak?", "What year are you?"
- Work authorization: visa status, citizenship, eligibility questions
- Availability: start date, work schedule, "When can you start?"
- Demographics: race, ethnicity, gender, age, disability status
- Simple preferences answered with dropdowns: location, remote/hybrid/in-office
- Salary numbers: expected salary, compensation range
- Yes/No questions or checkbox items
- Questions answered by selecting from a dropdown list

INCLUDE - Examples of GOOD open-ended questions to extract:
✓ "What's most exciting to you about this company and why do you want to work here?"
✓ "Please share one problem you've solved more efficiently with the help of AI"
✓ "Tell us one thing that's not on your resume that you're proud of"
✓ "Describe a challenging technical problem you solved"
✓ "Why are you interested in this internship?"
✓ "What unique perspective would you bring to our team?"
✓ "How did you hear about this position and what interests you?"
✓ "What are your career goals?"
✓ "Describe your experience with [specific technology/skill]"
✓ "Tell us about a time when you demonstrated leadership"
✓ "What motivates you to apply for this role?"

EXCLUDE - Examples of BAD questions to SKIP:
✗ "Preferred Name | What would you like us to call you?"
✗ "Name Pronunciation | How do you pronounce your name?"
✗ "What is your GitHub username?"
✗ "Which university do you attend?" (unless asking WHY you chose it)
✗ "What languages do you speak?" (factual list)
✗ "Link to your resume"
✗ "When can you start?" (just a date)
✗ "What is your expected salary?" (just a number)
✗ "Are you authorized to work in the US?" (yes/no)
✗ "What is your current GPA?" (just a number)
✗ "What year are you in school?" (dropdown/number)

VERIFICATION TEST:
Before including a question, ask: "Does this require the applicant to write sentences explaining their thoughts/experiences, or can it be answered with just a name/link/number/dropdown?"
- If it needs sentences/paragraphs → INCLUDE
- If it's just a factual field → EXCLUDE

WARNING: Do NOT invent questions. Only extract questions that are literally written in the text above.

IMPORTANT:
- Return ONLY a JSON array of strings with EXACT question text from the page
- Extract ALL open-ended questions you find - be inclusive, not exclusive
- If you don't see any open-ended questions in the text, return []
- Do NOT make up generic questions - only extract what's actually there
- Do NOT include markdown code fences
- Do NOT include any explanatory text

Extract ALL the open-ended questions found on this page:`

      const result = await model.generateContent(prompt)
      const response = await result.response
      let text = response.text().trim()

      // Handle markdown code fences
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) {
        text = codeBlockMatch[1].trim()
      }

      // Extract JSON array
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        console.warn('No JSON array found in Gemini response')
        return NextResponse.json(
          {
            error: 'Could not parse AI response. Please try again or add questions manually.',
            questions: [],
          },
          { status: 200 }
        )
      }

      const questions = JSON.parse(jsonMatch[0])

      if (!Array.isArray(questions)) {
        throw new Error('Response is not an array')
      }

      // Filter out empty strings and ensure all are strings
      const validQuestions = questions
        .filter((q) => typeof q === 'string' && q.trim().length > 0)
        .map((q) => q.trim())

      if (validQuestions.length === 0) {
        return NextResponse.json(
          {
            error: 'No open-ended questions found on this page. The application may only have basic form fields, or questions may be in a format that cannot be extracted (e.g., embedded in images or JavaScript forms).',
            questions: [],
          },
          { status: 200 }
        )
      }

      return NextResponse.json({
        questions: validQuestions,
      })
    } catch (error) {
      console.error('Error extracting questions with AI:', error)
      return NextResponse.json(
        {
          error: 'AI extraction failed. Please try again or add questions manually.',
          questions: [],
        },
        { status: 200 }
      )
    }
  } catch (error) {
    console.error('Unexpected error in extract-from-url:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
