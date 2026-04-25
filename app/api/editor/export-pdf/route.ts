import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/shared/db/supabase/server"
import { renderResumeHTML } from "@/lib/editor/render-html"
import type { TemplateId } from "@/modules/applications/components/editor/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Renders TipTap JSON into a print-ready HTML document, then drives a headless
 * Chromium via puppeteer-core (with @sparticuz/chromium for Vercel) to produce
 * a PDF. Returns the PDF buffer as application/pdf.
 *
 * Security: requires authenticated user. No external URLs fetched at print time.
 */

async function launchBrowser() {
    const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL === "1"
    const puppeteer = await import("puppeteer-core")

    if (isProduction) {
        const { default: chromium } = await import("@sparticuz/chromium")
        return puppeteer.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: true,
            defaultViewport: { width: 1240, height: 1754, deviceScaleFactor: 2 },
        })
    }

    const localExecutablePath =
        process.env.PUPPETEER_EXECUTABLE_PATH ||
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

    return puppeteer.launch({
        executablePath: localExecutablePath,
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const body = await req.json()
        const { contentJson, templateId, fileName } = body as {
            contentJson?: any
            templateId?: TemplateId
            fileName?: string
        }

        if (!contentJson) {
            return new NextResponse("Missing contentJson", { status: 400 })
        }

        const html = renderResumeHTML({
            contentJson,
            templateId: templateId ?? "modern",
            fileName,
        })

        const browser = await launchBrowser()
        try {
            const page = await browser.newPage()
            await page.setContent(html, { waitUntil: "networkidle0" })
            const pdf = await page.pdf({
                format: "A4",
                printBackground: true,
                margin: { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" },
                preferCSSPageSize: true,
            })

            const safeName = (fileName ?? "resume").replace(/\.[^.]+$/, "")
            return new NextResponse(pdf as unknown as BodyInit, {
                status: 200,
                headers: {
                    "Content-Type": "application/pdf",
                    "Content-Disposition": `attachment; filename="${safeName}_edited.pdf"`,
                    "Cache-Control": "no-store",
                },
            })
        } finally {
            await browser.close()
        }
    } catch (error: any) {
        console.error("[PDF Export] Error:", error)
        return new NextResponse(
            JSON.stringify({ error: error.message || "PDF export failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        )
    }
}
