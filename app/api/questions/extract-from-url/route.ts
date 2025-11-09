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

      const prompt = `You are an AI assistant that extracts meaningful application questions from job postings and scholarship pages.

Below is the text content extracted from a job/scholarship posting webpage:

${truncatedText}

CRITICAL RULES:
1. ONLY extract questions that are LITERALLY WRITTEN on the page - do NOT make up, invent, or hallucinate any questions
2. Copy the EXACT WORDING from the page - do not paraphrase or rewrite
3. Only extract questions where an AI would need the applicant's resume/experience to generate a thoughtful answer
4. If you don't see any essay questions on the page, return an empty array []

INCLUDE ONLY these types of questions (essay/open-ended questions that need AI assistance):
- "Why are you interested in this company/position?" or "Why do you want to work here?"
- "What excites you about this opportunity/role/product?"
- "Tell us about a time when..." or "Describe an experience where..."
- Questions asking for specific examples from their background
- Questions about challenges, problem-solving, or achievements
- Questions about goals, aspirations, or motivations
- "What would you bring to this role/team?"
- Questions asking for their perspective on industry topics or challenges

EXCLUDE ALL of these (the applicant knows these without needing AI):
- ANY personal information: name, preferred name, pronouns, name pronunciation
- Contact details: email, phone, address, city, state, country
- Links: resume, portfolio, GitHub, LinkedIn, personal website, social media
- Education details: university name, major, graduation date, GPA
- Simple factual questions: "What languages do you speak?", "What degree are you pursuing?"
- Work authorization, visa status, citizenship
- Availability: start date, work schedule, hours per week
- Demographics: race, ethnicity, gender, age, disability status
- Simple preferences: remote/in-office, location preference
- Salary/compensation expectations
- Yes/no questions or checkbox items
- Dropdown selections
- "Are you willing to..." or "Do you have..." questions

Examples of GOOD questions to extract (require thoughtful AI-generated answers):
✓ "What's most exciting to you about Palantir's offerings and why do you want to work here?"
✓ "Please share one problem you've been able to solve more efficiently with the help of AI."
✓ "Tell us one thing that's not on your resume that you're proud of."
✓ "Describe a challenging technical problem you solved and your approach."
✓ "Why are you interested in this internship and what do you hope to gain?"
✓ "What unique perspective or experience would you bring to our team?"

Examples of BAD questions to SKIP (applicant already knows the answer):
✗ "Preferred Name | What would you like us to call you?"
✗ "Name Pronunciation | How do you pronounce your name?"
✗ "What is your GitHub username?"
✗ "Which university do you attend?"
✗ "What languages do you speak?"
✗ "Link to your resume"
✗ "When can you start?"
✗ "What is your expected salary?"
✗ "Are you authorized to work in the US?"
✗ "What is your current GPA?"

VERIFICATION STEPS:
1. Find the actual question text on the page
2. Check: Is this an essay/open-ended question requiring 100+ word thoughtful response?
3. Check: Would an AI need resume/experience to answer this?
4. Check: Is this NOT a basic form field the applicant already knows?
5. If all checks pass, copy the EXACT question text and include it
6. If NO questions pass all checks, return empty array []

WARNING: Do NOT invent questions like "Why are you interested in this position?" if they don't actually appear on the page. Only extract questions that are literally written in the text above.

IMPORTANT:
- Return ONLY a JSON array of strings with EXACT question text from the page
- If you don't see any essay questions in the text, return []
- Do NOT make up generic questions - only extract what's actually there
- Do NOT include markdown code fences
- Do NOT include any explanatory text

Extract ONLY the actual essay questions found on this page:`

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
            error: 'No essay questions found on this page. The application may not have open-ended questions, or they may be in a format that cannot be extracted.',
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
