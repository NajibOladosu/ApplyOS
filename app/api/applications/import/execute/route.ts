import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/db/supabase/server'
import { createApplication } from '@/lib/services/applications'

interface ApplicationToImport {
  title: string
  company?: string
  url?: string
  status?: string
  priority?: string
  type?: string
  deadline?: string
  job_description?: string
  isDuplicate?: boolean
}

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { applications, skipDuplicates } = await request.json() as {
      applications: ApplicationToImport[]
      skipDuplicates: boolean
    }

    if (!applications || !Array.isArray(applications)) {
      return NextResponse.json({ error: 'Applications array is required' }, { status: 400 })
    }

    const importedApplications = []
    const failedApplications = []

    // Import each application
    for (const app of applications) {
      // Skip if duplicate and user wants to skip duplicates
      if (skipDuplicates && app.isDuplicate) {
        continue
      }

      try {
        const createdApp = await createApplication({
          title: app.title,
          company: app.company,
          url: app.url,
          priority: app.priority as any,
          type: app.type as any,
          deadline: app.deadline,
          job_description: app.job_description,
        })

        importedApplications.push(createdApp)
      } catch (err) {
        console.error(`Error importing application "${app.title}":`, err)
        failedApplications.push({
          title: app.title,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      imported: importedApplications.length,
      failed: failedApplications.length,
      applications: importedApplications,
      failures: failedApplications,
    })
  } catch (error) {
    console.error('Error executing CSV import:', error)
    return NextResponse.json({ error: 'Failed to import applications' }, { status: 500 })
  }
}
