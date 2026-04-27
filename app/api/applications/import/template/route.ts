import { NextRequest, NextResponse } from 'next/server'
import { generateCSVTemplate } from '@/modules/documents/lib/csv-utils'
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/middleware/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, RATE_LIMITS.general)
    if (rateLimitResponse) return rateLimitResponse

    const csvContent = generateCSVTemplate()

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="applyos-import-template.csv"',
      },
    })
  } catch (error) {
    console.error('Error generating CSV template:', error)
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 })
  }
}
