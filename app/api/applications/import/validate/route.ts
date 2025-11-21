import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateCSV } from '@/lib/csv-utils'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { csvContent } = await request.json()

    if (!csvContent) {
      return NextResponse.json({ error: 'CSV content is required' }, { status: 400 })
    }

    // Validate CSV
    const validationResult = validateCSV(csvContent)

    if (!validationResult.valid) {
      return NextResponse.json(
        { error: validationResult.error },
        { status: 400 }
      )
    }

    // Check for duplicates with existing applications
    const { data: existingApps, error: queryError } = await supabase
      .from('applications')
      .select('id, title, url')
      .eq('user_id', user.id)

    if (queryError) {
      console.error('Error fetching existing applications:', queryError)
      return NextResponse.json({ error: 'Failed to check for duplicates' }, { status: 500 })
    }

    // Mark duplicates in the validation result
    const applicationsWithDuplicateInfo = validationResult.applications.map((app) => {
      const hasDuplicate = existingApps?.some(
        (existing) =>
          existing.title.toLowerCase() === app.title.toLowerCase() &&
          ((!app.url && !existing.url) || (app.url && existing.url && app.url.toLowerCase() === existing.url.toLowerCase()))
      )

      return {
        ...app,
        isDuplicate: hasDuplicate,
      }
    })

    return NextResponse.json({
      valid: true,
      applications: applicationsWithDuplicateInfo,
      rowCount: validationResult.rowCount,
      errorCount: validationResult.errorCount,
      errors: validationResult.errors,
      duplicateCount: applicationsWithDuplicateInfo.filter((app) => app.isDuplicate).length,
    })
  } catch (error) {
    console.error('Error validating CSV:', error)
    return NextResponse.json({ error: 'Failed to validate CSV' }, { status: 500 })
  }
}
