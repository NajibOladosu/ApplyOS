import { NextRequest, NextResponse } from "next/server"
import type { JSONContent } from "@tiptap/core"
import { createClient } from "@/shared/db/supabase/server"
import { callGeminiWithFallback } from "@/shared/infrastructure/ai"
import { rateLimitMiddleware, RATE_LIMITS } from "@/lib/middleware/rate-limit"
import { MAX_LENGTHS } from "@/lib/validation"
import {
    applyEvidenceLedTailoring,
    collectEditableResumeBlocks,
} from "@/lib/resume-tailoring/engine"
import type {
    ProposedResumeEdit,
    ResumeTailoringPlan,
    TailoringMode,
    TailoringRequirement,
} from "@/lib/resume-tailoring/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_PLAN_REQUIREMENTS = 30
const MAX_PLAN_EDITS = 40

const parseJsonObject = (response: string): unknown => {
    const fenced = response.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
    const candidate = (fenced ?? response).trim()
    const start = candidate.indexOf("{")
    const end = candidate.lastIndexOf("}")
    if (start < 0 || end <= start) throw new Error("AI returned invalid JSON")
    return JSON.parse(candidate.slice(start, end + 1))
}

const cleanString = (value: unknown, maxLength: number) =>
    typeof value === "string" ? value.trim().slice(0, maxLength) : ""

const normalizePlan = (value: unknown): ResumeTailoringPlan => {
    if (!value || typeof value !== "object") throw new Error("AI returned an invalid tailoring plan")
    const candidate = value as {
        requirements?: unknown[]
        edits?: unknown[]
        familiaritySkills?: unknown[]
    }

    const requirements: TailoringRequirement[] = (candidate.requirements ?? [])
        .slice(0, MAX_PLAN_REQUIREMENTS)
        .map((item) => {
            const input = item as { requirement?: unknown; priority?: unknown }
            return {
                requirement: cleanString(input?.requirement, 160),
                priority: input?.priority === "preferred" ? "preferred" as const : "required" as const,
            }
        })
        .filter((item) => item.requirement.length > 1)

    const edits: ProposedResumeEdit[] = (candidate.edits ?? [])
        .slice(0, MAX_PLAN_EDITS)
        .map((item) => {
            const input = item as {
                blockIndex?: unknown
                originalText?: unknown
                replacementText?: unknown
                keywordsAdded?: unknown[]
                reason?: unknown
            }
            return {
                blockIndex: typeof input?.blockIndex === "number" ? Math.trunc(input.blockIndex) : -1,
                originalText: cleanString(input?.originalText, 1200),
                replacementText: cleanString(input?.replacementText, 1200),
                keywordsAdded: (input?.keywordsAdded ?? [])
                    .slice(0, 12)
                    .map((keyword) => cleanString(keyword, 100))
                    .filter(Boolean),
                reason: cleanString(input?.reason, 300),
            }
        })
        .filter((item) => item.blockIndex >= 0 && item.originalText && item.replacementText)

    const familiaritySkills = (candidate.familiaritySkills ?? [])
        .slice(0, 12)
        .map((skill) => cleanString(skill, 100))
        .filter(Boolean)

    return { requirements, edits, familiaritySkills }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return new NextResponse("Unauthorized", { status: 401 })

        const rateLimitResponse = await rateLimitMiddleware(
            req,
            RATE_LIMITS.ai,
            async () => user.id,
        )
        if (rateLimitResponse) return rateLimitResponse

        const body = await req.json() as {
            applicationId?: unknown
            documentId?: unknown
            resumeVersionId?: unknown
            contentJson?: unknown
            recommendations?: unknown
            mode?: unknown
        }
        const applicationId = cleanString(body.applicationId, 100)
        const documentId = cleanString(body.documentId, 100)
        const resumeVersionId = cleanString(body.resumeVersionId, 100)
        const mode: TailoringMode = body.mode === "interview-prep" ? "interview-prep" : "truthful"
        const contentJson = body.contentJson as JSONContent | undefined
        const recommendations = Array.isArray(body.recommendations) ? body.recommendations : []

        if (!applicationId || !documentId || !contentJson || contentJson.type !== "doc") {
            return new NextResponse("Missing or invalid required fields", { status: 400 })
        }
        if (recommendations.length === 0) {
            return new NextResponse("No recommendations provided", { status: 400 })
        }
        if (recommendations.length > MAX_LENGTHS.MAX_RECOMMENDATIONS) {
            return new NextResponse(
                `Too many recommendations (max ${MAX_LENGTHS.MAX_RECOMMENDATIONS})`,
                { status: 400 },
            )
        }
        const normalizedRecommendations = recommendations.map((recommendation) =>
            cleanString(recommendation, MAX_LENGTHS.recommendation),
        )
        if (normalizedRecommendations.some((recommendation) => !recommendation)) {
            return new NextResponse("Recommendations must be non-empty strings", { status: 400 })
        }

        const [appResult, documentResult] = await Promise.all([
            supabase
                .from("applications")
                .select("id, user_id, job_description, title, company")
                .eq("id", applicationId)
                .single(),
            supabase
                .from("documents")
                .select("id, user_id")
                .eq("id", documentId)
                .single(),
        ])
        const app = appResult.data
        const document = documentResult.data
        if (appResult.error || !app) return new NextResponse("Application not found", { status: 404 })
        if (documentResult.error || !document) return new NextResponse("Document not found", { status: 404 })
        if (app.user_id !== user.id || document.user_id !== user.id) {
            return new NextResponse("Forbidden", { status: 403 })
        }
        if (!app.job_description?.trim()) {
            return new NextResponse("Application has no job description", { status: 400 })
        }

        if (resumeVersionId) {
            const { data: version, error: versionError } = await supabase
                .from("resume_versions")
                .select("id, user_id, document_id")
                .eq("id", resumeVersionId)
                .single()
            if (
                versionError
                || !version
                || version.user_id !== user.id
                || version.document_id !== documentId
            ) {
                return new NextResponse("Resume version not found or forbidden", { status: 403 })
            }
        }

        const blocks = collectEditableResumeBlocks(contentJson)
        if (blocks.length === 0) {
            return new NextResponse("This resume contains no editable text", { status: 400 })
        }

        const modeInstructions = mode === "interview-prep"
            ? `INTERVIEW PREP MODE: Normal resume edits must still be fully supported by the source resume. You may also return closely related but unsupported requirements in familiaritySkills. Do not put those skills inside experience, projects, summary, or normal skills edits.`
            : `TRUTHFUL MODE: familiaritySkills must be empty. Never introduce a requirement unless the source blocks already contain direct or equivalent evidence for it.`

        const prompt = `You are planning a careful, evidence-led resume tailoring pass. Return a small set of surgical block rewrites, not a replacement resume.

Target role: ${app.title || "Unknown"}${app.company ? ` at ${app.company}` : ""}

JOB DESCRIPTION:
${app.job_description.slice(0, 9000)}

RECOMMENDATIONS:
${normalizedRecommendations.map((item, index) => `${index + 1}. ${item}`).join("\n")}

MODE:
${modeInstructions}

SOURCE RESUME BLOCKS:
${blocks.map((block) => `[${block.blockIndex}] <${block.type}> ${block.text}`).join("\n")}

NON-NEGOTIABLE RULES:
- Extract the important required and preferred job requirements before proposing edits.
- Every edit must reference one blockIndex and repeat that block's originalText exactly.
- Never edit names, contact details, section labels, employers, job titles, schools, dates, or locations.
- Never invent or alter metrics, percentages, currencies, team sizes, scale, certifications, degrees, employers, projects, responsibilities, tools, or outcomes.
- A keyword may be added only when the source resume contains direct evidence for the same skill or a common naming variant.
- Keep the meaning and tense of each source block. Start achievement bullets with a strong action verb where appropriate.
- Keep each replacement within roughly 20 percent of the source word count so the layout remains stable.
- Prefer 3 to 10 high-value edits. Do not rewrite blocks that are already strong.
- keywordsAdded must list every job-description term newly introduced by that edit.
- requirements should contain concise skill or qualification phrases, not whole sentences.

Return ONLY JSON in this shape:
{
  "requirements": [
    { "requirement": "PostgreSQL", "priority": "required" }
  ],
  "edits": [
    {
      "blockIndex": 4,
      "originalText": "exact source text",
      "replacementText": "truthful improved text",
      "keywordsAdded": ["PostgreSQL"],
      "reason": "why this improves relevance"
    }
  ],
  "familiaritySkills": []
}`

        const response = await callGeminiWithFallback(prompt, "COMPLEX")
        const plan = normalizePlan(parseJsonObject(response))
        const result = applyEvidenceLedTailoring(contentJson, plan, mode)

        return NextResponse.json({
            ...result,
            suggestedTemplate: "ats",
            suggestedDocSettings: {
                marginTopMm: 12,
                marginRightMm: 14,
                marginBottomMm: 12,
                marginLeftMm: 14,
            },
        })
    } catch (error) {
        console.error("[Apply Recommendations] Error:", error)
        const message = error instanceof SyntaxError
            ? "AI returned malformed JSON. Please try again."
            : error instanceof Error && error.message.includes("AI is not configured")
                ? error.message
                : "Failed to generate a safe tailored resume. Please try again."
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
