/**
 * Analytics Status Flow API Route
 * GET /api/analytics/status-flow?timeRange=7d|30d|90d|all
 * Returns Sankey diagram data for application status transitions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server'
import { getStatusFlowData, type TimeRange } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get time range from query params
    const searchParams = request.nextUrl.searchParams
    const timeRange = (searchParams.get('timeRange') || 'all') as TimeRange

    // Validate time range
    const validTimeRanges: TimeRange[] = ['7d', '30d', '90d', 'all']
    if (!validTimeRanges.includes(timeRange)) {
      return NextResponse.json(
        { error: 'Invalid time range. Must be one of: 7d, 30d, 90d, all' },
        { status: 400 }
      )
    }

    // Fetch status flow data, passing the server Supabase client
    const statusFlow = await getStatusFlowData(timeRange, supabase)

    return NextResponse.json({
      success: true,
      timeRange,
      data: statusFlow,
    })
  } catch (error) {
    console.error('Analytics status flow route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
