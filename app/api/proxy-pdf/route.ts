import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const url = searchParams.get("url")

    console.log("Proxy Request:", req.url)
    console.log("Target URL:", url)

    if (!url) {
        return new NextResponse("Missing url parameter", { status: 400 })
    }

    try {
        // Check if it's a Supabase Storage URL for 'documents' bucket
        if (url.includes("/documents/")) {
            const pathParts = url.split("/documents/")
            if (pathParts.length > 1) {
                const filePath = pathParts[1] // e.g. "uuid/filename.pdf"
                console.log("Attempting Supabase Download for path:", filePath)

                const supabase = await createClient()
                const { data, error } = await supabase.storage.from("documents").download(filePath)

                if (error) {
                    console.error("Supabase Download Error:", error)
                    return new NextResponse(`Supabase Storage Error: ${error.message}`, { status: 500 })
                }

                if (data) {
                    return new NextResponse(data, {
                        headers: {
                            "Content-Type": "application/pdf",
                            "Cache-Control": "public, max-age=3600"
                        }
                    })
                }
            }
        }

        // Fallback or external URL
        console.log("Falling back to standard fetch")
        const response = await fetch(url)
        if (!response.ok) {
            console.error("Fetch failed:", response.status, response.statusText)
            const body = await response.text()
            console.error("Error Body:", body)
            return new NextResponse(`Failed to fetch PDF: ${response.statusText}`, { status: response.status })
        }

        const blob = await response.blob()
        return new NextResponse(blob, {
            headers: {
                "Content-Type": "application/pdf",
                "Cache-Control": "public, max-age=3600"
            }
        })
    } catch (error) {
        console.error("PDF Proxy Error:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
