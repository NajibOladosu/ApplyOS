/**
 * Analytics Metrics API Route
 * GET /api/analytics/metrics?timeRange=7d|30d|90d|all
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getApplicationMetrics,
  getTimelineTrends,
  getConversionFunnel,
  getApplicationsByType,
  getApplicationsByPriority,
  type TimeRange,
} from '@/lib/services/analytics'

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

    // Fetch all metrics in parallel, passing the server Supabase client
    const [metrics, timeline, funnel, byType, byPriority] = await Promise.all([
      getApplicationMetrics(timeRange, supabase),
      getTimelineTrends(timeRange, 'day', supabase),
      getConversionFunnel(timeRange, supabase),
      getApplicationsByType(timeRange, supabase),
      getApplicationsByPriority(timeRange, supabase),
    ])

    return NextResponse.json({
      success: true,
      timeRange,
      data: {
        metrics,
        timeline,
        funnel,
        byType,
        byPriority,
      },
    })
  } catch (error) {
    console.error('Analytics metrics route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
