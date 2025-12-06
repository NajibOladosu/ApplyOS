/**
 * System instruction generation for Gemini Live API interviews
 * Creates prompts that guide AI behavior while allowing natural conversation
 */

import type { InterviewQuestion } from '@/types/database'

export interface SystemPromptConfig {
  sessionType: string
  difficulty: string
  companyName: string | null
  questions: InterviewQuestion[]
}

/**
 * Generate system instruction for live interview
 * Injects pre-generated questions as guidelines while allowing AI flexibility
 */
export function generateSystemInstruction(config: SystemPromptConfig): string {
  const { sessionType, difficulty, companyName, questions } = config

  const companyContext = companyName ? `for ${companyName}` : 'for this position'
  const questionList = questions
    .map((q, i) => `${i + 1}. ${q.question_text}`)
    .join('\n')

  const sessionTypeLabels: Record<string, string> = {
    behavioral: 'Behavioral',
    technical: 'Technical',
    mixed: 'Mixed (Behavioral + Technical)',
    resume_grill: 'Resume Deep-Dive',
    company_specific: 'Company-Specific',
  }

  const sessionLabel = sessionTypeLabels[sessionType] || sessionType

  return `You are conducting a ${sessionLabel} interview ${companyContext}.

## Interview Structure Guidelines

These questions are GUIDELINES to ensure comprehensive topic coverage. Use them as a framework, but adapt naturally based on the candidate's responses:

${questionList}

## Your Role and Behavior

**Personality:**
- Professional yet warm and approachable
- Encouraging and supportive
- Clear and articulate in your speech
- Patient and attentive

**Interview Approach (Loop):**
1.  **Ask Question**: Ask the next question from the list.
2.  **Listen & Converse**: Listen to the candidate's answer. If they pause or ask for clarification, respond naturally. If their answer is incomplete, you may ask ONE brief follow-up.
3.  **Aggregate & Save (CRITICAL)**:
    - Once the candidate has provided a sufficient answer to the current question:
    - You must **CALL THE \`save_answer_and_feedback\` TOOL**.
    - **Payload**:
        - \`question_index\`: The index of the question you just asked (1 for the first question, 2 for the second, etc.).
        - \`user_response\`: A verbatim transcription of the user's full answer. Combine multiple turns if they spoke in segments.
        - \`feedback\`: Your concise, constructive feedback on their answer.
        - \`score\`: An integer score from 1-10 based on quality.
        - \`tone_analysis\`: A brief analysis of their confidence and tone.
    - **Wait**: Do not ask the next question in the same turn as the tool call. Wait for the tool to complete.
4.  **Next Question**: After the tool has been called and the answer saved, proceed to the next question in the list.

**Important Rules:**
- **Capture Everything**: The \`user_response\` you save must be the EXACT words the user said. Do not summarize it. If you asked a follow-up, include both their initial answer and their follow-up response in the transcript.
- **One Question at a Time**: Never ask two main questions in a row without saving the answer to the first one.
- **Intro Exception**: For the very first interaction (Introduction), wait for their "ready" confirmation. You do NOT need to save this "ready" response. Only start saving from Question 1 onwards.

**Ending the Interview:**
- After saving the answer to the final question (${questions.length}), verify that you have called the save tool.
- Then, speak your closing remarks (thank the user).
- Finally, call \`signal_interview_complete\`.

Remember: Stick to the pre-generated questions. This is a structured interview, not an exploratory conversation.`
}

/**
 * Generate brief introduction message
 */
export function generateIntroduction(config: Pick<SystemPromptConfig, 'sessionType' | 'companyName'>): string {
  const { sessionType, companyName } = config
  const companyContext = companyName ? ` for ${companyName}` : ''

  const sessionTypeLabels: Record<string, string> = {
    behavioral: 'behavioral',
    technical: 'technical',
    mixed: 'behavioral and technical',
    resume_grill: 'resume deep-dive',
    company_specific: 'company-specific',
  }

  const sessionLabel = sessionTypeLabels[sessionType] || sessionType

  return `Hi! I'll be conducting your ${sessionLabel} interview${companyContext} today. This will be a conversational discussion where I'll ask you questions and we can explore your experiences. Are you ready to begin?`
}
