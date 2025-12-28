import { NextResponse } from 'next/server'
import { generateCSVTemplate } from '@/lib/csv-utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
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
