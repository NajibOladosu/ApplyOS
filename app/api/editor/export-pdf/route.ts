import { NextRequest, NextResponse } from "next/server"
import chromium from "@sparticuz/chromium"
import puppeteer from "puppeteer-core"

export async function POST(req: NextRequest) {
    try {
        const { blocks, fileName } = await req.json()

        if (!blocks || !Array.isArray(blocks)) {
            return new NextResponse("Invalid blocks", { status: 400 })
        }

        // 1. Generate HTML
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
                    body { 
                        font-family: 'Inter', -apple-system, sans-serif; 
                        margin: 0; 
                        padding: 20mm; 
                        color: #111;
                        line-height: 1.5;
                    }
                    h1 { font-size: 28pt; margin: 0 0 4mm 0; text-align: center; font-weight: 700; color: #000; }
                    .contact-line { font-size: 10pt; margin-bottom: 8mm; text-align: center; color: #444; }
                    h2 { 
                        font-size: 14pt; 
                        margin: 8mm 0 3mm 0; 
                        border-bottom: 1.5pt solid #eee; 
                        padding-bottom: 1mm;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 0.5pt;
                    }
                    h3 { font-size: 11pt; margin: 5mm 0 1mm 0; font-weight: 600; color: #222; }
                    p { font-size: 10pt; margin: 0 0 2mm 0; color: #333; }
                    ul { margin: 0 0 4mm 0; padding-left: 5mm; }
                    li { font-size: 10pt; margin-bottom: 1.5mm; color: #333; list-style-type: disc; }
                    
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .font-bold { font-weight: 700; }
                    .italic { font-style: italic; }
                    .underline { text-decoration: underline; }
                </style>
            </head>
            <body>
                ${blocks.map(block => {
            const styleClass = [
                block.styles?.align ? `text-${block.styles.align}` : '',
                block.styles?.bold ? 'font-bold' : '',
                block.styles?.italic ? 'italic' : '',
                block.styles?.underline ? 'underline' : ''
            ].filter(Boolean).join(' ')

            if (block.type === 'h1') return `<h1 class="${styleClass}">${block.content}</h1>`
            if (block.type === 'h2') return `<h2 class="${styleClass}">${block.content}</h2>`
            if (block.type === 'h3') return `<h3 class="${styleClass}">${block.content}</h3>`
            if (block.type === 'bullet') return `<li class="${styleClass}">${block.content}</li>`
            if (block.type === 'paragraph' && block.styles?.align === 'center' && block.content.includes('|')) {
                return `<div class="contact-line ${styleClass}">${block.content}</div>`
            }
            return `<p class="${styleClass}">${block.content}</p>`
        }).reduce((acc, curr, idx, arr) => {
            // Group bullets into <ul>
            if (curr.startsWith('<li')) {
                if (idx === 0 || !arr[idx - 1].startsWith('<li')) {
                    return acc + '<ul>' + curr
                }
                if (idx === arr.length - 1 || !arr[idx + 1].startsWith('<li')) {
                    return acc + curr + '</ul>'
                }
                return acc + curr
            }
            return acc + curr
        }, "")}
            </body>
            </html>
        `

        // 2. Launch Puppeteer
        const browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: { width: 794, height: 1123, deviceScaleFactor: 2 }, // A4 at 96 DPI
            executablePath: await chromium.executablePath(),
            headless: true, // Chromium.headless is recommended if available, but true is safe
        })

        const page = await browser.newPage()
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' })

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
        })

        await browser.close()

        return new Response(pdf, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${fileName || 'resume'}.pdf"`
            }
        })

    } catch (error: any) {
        console.error("PDF Export Error:", error)
        return new NextResponse(error.message || "Internal Server Error", { status: 500 })
    }
}
