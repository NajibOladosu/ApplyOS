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
  getStatusFlowData,
  type TimeRange,
} from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log('\n=== ANALYTICS METRICS API ROUTE ===')

    // Verify user is authenticated
    const supabase = await createSupabaseServerClient()
    console.log('Supabase server client created')

    const {
      data: { user },
    } = await supabase.auth.getUser()
    console.log(`User authenticated: ${user ? user.id : 'No user'}`)

    if (!user) {
      console.log('Unauthorized - no user found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get time range from query params
    const searchParams = request.nextUrl.searchParams
    const timeRange = (searchParams.get('timeRange') || 'all') as TimeRange
    console.log(`Time range requested: ${timeRange}`)

    // Validate time range
    const validTimeRanges: TimeRange[] = ['7d', '30d', '90d', 'all']
    if (!validTimeRanges.includes(timeRange)) {
      console.log(`Invalid time range: ${timeRange}`)
      return NextResponse.json(
        { error: 'Invalid time range. Must be one of: 7d, 30d, 90d, all' },
        { status: 400 }
      )
    }

    console.log('Starting parallel analytics queries...')

    // Fetch metrics in batches to avoid connection pool exhaustion
    // Batch 1: Core metrics and timeline
    const [metrics, timeline] = await Promise.all([
      getApplicationMetrics(timeRange, supabase).catch(err => {
        console.error('Error in getApplicationMetrics:', err)
        throw err
      }),
      getTimelineTrends(timeRange, 'day', supabase).catch(err => {
        console.error('Error in getTimelineTrends:', err)
        throw err
      }),
    ])

    // Batch 2: Funnel, breakdowns, and status flow
    const [funnel, byType, byPriority, statusFlow] = await Promise.all([
      getConversionFunnel(timeRange, supabase).catch(err => {
        console.error('Error in getConversionFunnel:', err)
        throw err
      }),
      getApplicationsByType(timeRange, supabase).catch(err => {
        console.error('Error in getApplicationsByType:', err)
        throw err
      }),
      getApplicationsByPriority(timeRange, supabase).catch(err => {
        console.error('Error in getApplicationsByPriority:', err)
        throw err
      }),
      getStatusFlowData(timeRange, supabase).catch(err => {
        console.error('Error in getStatusFlowData:', err)
        throw err
      }),
    ])

    console.log('All analytics queries completed successfully')
    console.log('=== END ANALYTICS METRICS API ROUTE ===\n')

    return NextResponse.json({
      success: true,
      timeRange,
      data: {
        metrics,
        timeline,
        funnel,
        byType,
        byPriority,
        statusFlow,
      },
    })
  } catch (error) {
    console.error('\n!!! ANALYTICS METRICS API ROUTE ERROR !!!')
    console.error('Analytics metrics route error:', {
      message: error instanceof Error ? error.message : String(error),
      details: error instanceof Error ? error.stack : String(error),
      hint: error && typeof error === 'object' && 'hint' in error ? error.hint : '',
      code: error && typeof error === 'object' && 'code' in error ? error.code : '',
    })
    console.error('=== END ERROR ===\n')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
