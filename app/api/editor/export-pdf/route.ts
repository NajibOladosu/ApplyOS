import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 60

export async function POST(req: NextRequest) {
    try {
        const { blocks, fileName } = await req.json()

        if (!blocks || !Array.isArray(blocks)) {
            return new NextResponse("Invalid blocks", { status: 400 })
        }

        console.log("[PDF Export] Generating HTML for", blocks.length, "blocks")

        // Generate print-ready HTML
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${fileName || 'resume'}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
                    
                    @page {
                        size: A4;
                        margin: 20mm;
                    }
                    
                    * {
                        box-sizing: border-box;
                    }
                    
                    body { 
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
                        margin: 0; 
                        padding: 0;
                        color: #111;
                        line-height: 1.5;
                        font-size: 11pt;
                    }
                    
                    .page-content {
                        max-width: 170mm;
                        margin: 0 auto;
                    }
                    
                    h1 { 
                        font-size: 32px; 
                        margin: 0 0 8px 0; 
                        font-weight: 700; 
                        color: #000;
                        line-height: 1.2;
                    }
                    
                    .contact-line { 
                        font-size: 11pt; 
                        margin-bottom: 16px; 
                        color: #444; 
                    }
                    
                    h2 { 
                        font-size: 18px; 
                        margin: 24px 0 8px 0; 
                        border-bottom: 2px solid #ddd; 
                        padding-bottom: 4px;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        color: #000;
                        page-break-after: avoid;
                    }
                    
                    h3 { 
                        font-size: 14px; 
                        margin: 16px 0 4px 0; 
                        font-weight: 600; 
                        color: #222;
                        page-break-after: avoid;
                    }
                    
                    p { 
                        font-size: 11pt; 
                        margin: 0 0 6px 0; 
                        color: #333;
                        orphans: 3;
                        widows: 3;
                    }
                    
                    ul { 
                        margin: 0 0 12px 0; 
                        padding-left: 20px;
                        page-break-inside: avoid;
                    }
                    
                    li { 
                        font-size: 11pt; 
                        margin-bottom: 4px; 
                        color: #333; 
                        list-style-type: disc;
                        orphans: 2;
                        widows: 2;
                    }
                    
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .text-left { text-align: left; }
                    .font-bold { font-weight: 700; }
                    .italic { font-style: italic; }
                    .underline { text-decoration: underline; }
                    
                    @media print {
                        body {
                            background: white;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="page-content">
                    ${blocks.map((block: any) => {
            const styleClass = [
                block.styles?.align ? `text-${block.styles.align}` : '',
                block.styles?.bold ? 'font-bold' : '',
                block.styles?.italic ? 'italic' : '',
                block.styles?.underline ? 'underline' : ''
            ].filter(Boolean).join(' ')

            const content = String(block.content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')

            if (block.type === 'h1') return `<h1 class="${styleClass}">${content}</h1>`
            if (block.type === 'h2') return `<h2 class="${styleClass}">${content}</h2>`
            if (block.type === 'h3') return `<h3 class="${styleClass}">${content}</h3>`
            if (block.type === 'bullet') return `<li class="${styleClass}">${content}</li>`
            if (block.type === 'paragraph' && block.styles?.align === 'center' && content.includes('|')) {
                return `<div class="contact-line ${styleClass}">${content}</div>`
            }
            return `<p class="${styleClass}">${content}</p>`
        }).reduce((acc: string, curr: string, idx: number, arr: string[]) => {
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
                </div>
            </body>
            </html>
        `

        // Return HTML for client-side printing
        return new NextResponse(htmlContent, {
            headers: {
                "Content-Type": "text/html",
                "Content-Disposition": `inline; filename="${fileName || 'resume'}.html"`
            }
        })

    } catch (error: any) {
        console.error("[PDF Export] Error:", error)
        return new NextResponse(
            `PDF Export Error: ${error.message}`,
            { status: 500 }
        )
    }
}
