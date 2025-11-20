import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { subDays, startOfDay, format, addDays } from 'date-fns'
import type { ApplicationStatus } from '@/types/database'

export type TimeRange = '7d' | '30d' | '90d' | 'all'

interface ApplicationMetrics {
  total: number
  successRate: number
  averageTimeToOutcome: number | null
  interviewConversionRate: number
}

interface StatusFlowData {
  nodes: Array<{ name: string; value?: number }>
  links: Array<{ source: number; target: number; value: number }>
}

interface TimelineDataPoint {
  date: string
  count: number
}

interface ConversionFunnelStage {
  stage: string
  count: number
  percentage: number
}

interface TypeBreakdown {
  type: string
  count: number
  percentage: number
}

interface PriorityBreakdown {
  priority: string
  count: number
  percentage: number
}

/**
 * Get date filter for time range
 */
function getDateFilter(timeRange: TimeRange): Date | null {
  if (timeRange === 'all') return null

  const days = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
  }

  return startOfDay(subDays(new Date(), days[timeRange]))
}

/**
 * Get application metrics for the specified time range
 */
export async function getApplicationMetrics(
  timeRange: TimeRange = 'all',
  supabaseClient?: SupabaseClient
): Promise<ApplicationMetrics> {
  try {
    console.log('\n=== GET APPLICATION METRICS ===')
    console.log(`Time Range: ${timeRange}`)

    const supabase = supabaseClient || createClient()
    const dateFilter = getDateFilter(timeRange)
    console.log(`Date Filter: ${dateFilter ? dateFilter.toISOString() : 'None'}`)

    let query = supabase
      .from('applications')
      .select('status, created_at, updated_at')

    if (dateFilter) {
      query = query.gte('created_at', dateFilter.toISOString())
    }

    console.log('Executing query to applications table...')
    const { data: applications, error } = await query
    console.log(`Query completed. Found ${applications?.length || 0} applications`)

    if (error) {
      console.error('Supabase error in getApplicationMetrics:', error)
      throw error
    }

  const total = applications?.length || 0
  if (total === 0) {
    return {
      total: 0,
      successRate: 0,
      averageTimeToOutcome: null,
      interviewConversionRate: 0,
    }
  }

  // Calculate success rate (offers / total submitted or beyond)
  const submitted = applications?.filter(app =>
    ['submitted', 'in_review', 'interview', 'offer', 'rejected'].includes(app.status)
  ).length || 0

  const offers = applications?.filter(app => app.status === 'offer').length || 0
  const successRate = submitted > 0 ? (offers / submitted) * 100 : 0

  // Calculate interview conversion rate (interviews / submitted)
  const interviews = applications?.filter(app =>
    ['interview', 'offer'].includes(app.status)
  ).length || 0
  const interviewConversionRate = submitted > 0 ? (interviews / submitted) * 100 : 0

  // Calculate average time to outcome (for completed applications: offer or rejected)
  const completedApps = applications?.filter(app =>
    ['offer', 'rejected'].includes(app.status)
  ) || []

  let averageTimeToOutcome: number | null = null
  if (completedApps.length > 0) {
    const totalDays = completedApps.reduce((sum, app) => {
      const created = new Date(app.created_at).getTime()
      const updated = new Date(app.updated_at).getTime()
      const days = (updated - created) / (1000 * 60 * 60 * 24)
      return sum + days
    }, 0)
    averageTimeToOutcome = Math.round(totalDays / completedApps.length)
  }

    const result = {
      total,
      successRate: Math.round(successRate * 10) / 10,
      averageTimeToOutcome,
      interviewConversionRate: Math.round(interviewConversionRate * 10) / 10,
    }

    console.log('Metrics calculated:', result)
    console.log('=== END GET APPLICATION METRICS ===\n')

    return result
  } catch (err) {
    console.error('!!! ERROR in getApplicationMetrics !!!')
    console.error({
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      error: err
    })
    throw err
  }
}

/**
 * Get status flow data for Sankey diagram
 * Shows direct path from draft to current status for each application
 */
export async function getStatusFlowData(
  timeRange: TimeRange = 'all',
  supabaseClient?: SupabaseClient
): Promise<StatusFlowData> {
  const supabase = supabaseClient || createClient()
  const dateFilter = getDateFilter(timeRange)

  // Define the flow stages in order
  const stages: ApplicationStatus[] = ['draft', 'submitted', 'in_review', 'interview', 'offer', 'rejected']

  // Get ALL applications
  const { data: allApplications, error: appsError } = await supabase
    .from('applications')
    .select('id, status, created_at')
    .order('created_at', { ascending: true })

  if (appsError) throw appsError

  console.log('=== SANKEY GRAPH DEBUG ===')
  console.log(`Time Range: ${timeRange}`)
  console.log(`Date Filter: ${dateFilter ? dateFilter.toISOString() : 'None (All Time)'}`)
  console.log(`Total Applications in DB: ${allApplications?.length || 0}`)

  if (!allApplications || allApplications.length === 0) {
    console.log('No applications found in database')
    return { nodes: [], links: [] }
  }

  // Log all applications with their status
  console.log('All Applications:')
  allApplications.forEach(app => {
    console.log(`  - ID: ${app.id.substring(0, 8)}..., Status: ${app.status}, Created: ${new Date(app.created_at).toLocaleDateString()}`)
  })

  // Determine which applications to include based on time filter
  let includedAppIds: Set<string>

  if (!dateFilter) {
    // All Time: Include all applications
    includedAppIds = new Set(allApplications.map(app => app.id))
    console.log(`All Time Filter: Including all ${allApplications.length} applications`)
  } else {
    // Time-filtered: Include apps with transitions in time range OR created in time range
    includedAppIds = new Set<string>()

    // Get all status history in the time range
    const { data: recentHistory, error: historyError } = await supabase
      .from('status_history')
      .select('application_id')
      .gte('timestamp', dateFilter.toISOString())

    if (historyError) throw historyError

    console.log(`Status History Transitions in Time Range: ${recentHistory?.length || 0}`)

    // Add apps that had transitions
    recentHistory?.forEach(h => {
      includedAppIds.add(h.application_id)
      console.log(`  - Including app ${h.application_id.substring(0, 8)}... (had transition)`)
    })

    // Add apps created in the time range
    const createdInRange: string[] = []
    allApplications.forEach(app => {
      if (new Date(app.created_at) >= dateFilter) {
        includedAppIds.add(app.id)
        createdInRange.push(app.id)
        console.log(`  - Including app ${app.id.substring(0, 8)}... (created in range: ${new Date(app.created_at).toLocaleDateString()})`)
      }
    })

    console.log(`Total Apps with Transitions: ${recentHistory?.length || 0}`)
    console.log(`Total Apps Created in Range: ${createdInRange.length}`)
    console.log(`Total Unique Apps Included: ${includedAppIds.size}`)
  }

  // Filter applications to only included ones
  const includedApplications = allApplications.filter(app => includedAppIds.has(app.id))

  console.log(`\nFinal Included Applications: ${includedApplications.length}`)
  includedApplications.forEach(app => {
    console.log(`  - ID: ${app.id.substring(0, 8)}..., Status: ${app.status}`)
  })

  if (includedApplications.length === 0) {
    console.log('No applications to display in Sankey')
    console.log('=== END SANKEY DEBUG ===\n')
    return { nodes: [], links: [] }
  }

  // Build direct path from draft to current status for each application
  const flowCounts = new Map<string, number>()
  let draftCount = 0

  console.log('\nBuilding Flow Paths:')
  includedApplications.forEach(app => {
    const currentStatus = app.status as ApplicationStatus
    const currentIndex = stages.indexOf(currentStatus)

    console.log(`\nApp ${app.id.substring(0, 8)}...: Status = ${currentStatus} (index ${currentIndex})`)

    if (currentIndex === -1) {
      console.log('  ⚠️  Invalid status (not in stages array)')
      return
    }

    if (currentIndex === 0) {
      draftCount++
      console.log(`  ℹ️  Status is "draft" - counting as draft (total: ${draftCount})`)
      return
    }

    // Build direct path: draft → current status
    // For example: if current is "in_review" (index 2), path is draft(0) → submitted(1) → in_review(2)
    console.log(`  Building path from draft (0) to ${currentStatus} (${currentIndex}):`)
    for (let i = 0; i < currentIndex; i++) {
      const from = stages[i]
      const to = stages[i + 1]
      const key = `${from}->${to}`
      const newCount = (flowCounts.get(key) || 0) + 1
      flowCounts.set(key, newCount)
      console.log(`    ${from} → ${to} (count: ${newCount})`)
    }
  })

  console.log(`\nTotal applications in draft: ${draftCount}`)
  console.log('Note: Draft applications have no outgoing links in the Sankey')

  console.log('\nFinal Flow Counts:')
  flowCounts.forEach((count, key) => {
    console.log(`  ${key}: ${count}`)
  })

  // Calculate node values based on current status counts
  const statusCounts = new Map<ApplicationStatus, number>()
  includedApplications.forEach(app => {
    const status = app.status as ApplicationStatus
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1)
  })

  console.log('\nStatus Counts:')
  statusCounts.forEach((count, status) => {
    console.log(`  ${status}: ${count}`)
  })

  // Create nodes with values
  const nodes = stages.map(stage => {
    const count = statusCounts.get(stage) || 0
    return {
      name: stage.charAt(0).toUpperCase() + stage.slice(1).replace('_', ' '),
      value: count
    }
  })

  console.log('\nNodes with values:')
  nodes.forEach(node => {
    console.log(`  ${node.name}: ${node.value}`)
  })

  // Create links from flow counts
  const links: Array<{ source: number; target: number; value: number }> = []

  flowCounts.forEach((count, key) => {
    const [from, to] = key.split('->')
    const fromIndex = stages.indexOf(from as ApplicationStatus)
    const toIndex = stages.indexOf(to as ApplicationStatus)

    if (fromIndex !== -1 && toIndex !== -1 && count > 0) {
      links.push({
        source: fromIndex,
        target: toIndex,
        value: count,
      })
      console.log(`  Creating link: ${from}[${fromIndex}] → ${to}[${toIndex}] (value: ${count})`)
    }
  })

  console.log(`\nTotal Links Created: ${links.length}`)
  console.log('Links:', JSON.stringify(links, null, 2))
  console.log('=== END SANKEY DEBUG ===\n')

  return { nodes, links }
}

/**
 * Get timeline trend data for applications over time
 */
export async function getTimelineTrends(
  timeRange: TimeRange = '30d',
  granularity: 'day' | 'week' | 'month' = 'day',
  supabaseClient?: SupabaseClient
): Promise<TimelineDataPoint[]> {
  const supabase = supabaseClient || createClient()
  const dateFilter = getDateFilter(timeRange)

  let query = supabase
    .from('applications')
    .select('created_at')
    .order('created_at', { ascending: true })

  if (dateFilter) {
    query = query.gte('created_at', dateFilter.toISOString())
  }

  const { data: applications, error } = await query

  if (error) throw error

  // Group by date based on granularity
  const dateCounts = new Map<string, number>()

  applications?.forEach(app => {
    const date = new Date(app.created_at)
    let dateKey: string

    switch (granularity) {
      case 'day':
        dateKey = format(date, 'yyyy-MM-dd')
        break
      case 'week':
        dateKey = format(startOfDay(date), 'yyyy-MM-dd')
        break
      case 'month':
        dateKey = format(date, 'yyyy-MM')
        break
    }

    dateCounts.set(dateKey, (dateCounts.get(dateKey) || 0) + 1)
  })

  // Fill in missing dates with 0 counts
  if (dateFilter) {
    const startDate = startOfDay(dateFilter)
    const endDate = startOfDay(new Date())
    let currentDate = startDate

    while (currentDate <= endDate) {
      const dateKey = format(currentDate, 'yyyy-MM-dd')
      if (!dateCounts.has(dateKey)) {
        dateCounts.set(dateKey, 0)
      }
      currentDate = addDays(currentDate, 1)
    }
  } else if (applications && applications.length > 0) {
    // For 'all' time range, fill dates between earliest and latest
    const dates = applications.map(app => new Date(app.created_at))
    const startDate = startOfDay(new Date(Math.min(...dates.map(d => d.getTime()))))
    const endDate = startOfDay(new Date(Math.max(...dates.map(d => d.getTime()))))
    let currentDate = startDate

    while (currentDate <= endDate) {
      const dateKey = format(currentDate, 'yyyy-MM-dd')
      if (!dateCounts.has(dateKey)) {
        dateCounts.set(dateKey, 0)
      }
      currentDate = addDays(currentDate, 1)
    }
  }

  // Convert to array and sort
  return Array.from(dateCounts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Get conversion funnel data
 */
export async function getConversionFunnel(
  timeRange: TimeRange = 'all',
  supabaseClient?: SupabaseClient
): Promise<ConversionFunnelStage[]> {
  const supabase = supabaseClient || createClient()
  const dateFilter = getDateFilter(timeRange)

  let query = supabase
    .from('applications')
    .select('status')

  if (dateFilter) {
    query = query.gte('created_at', dateFilter.toISOString())
  }

  const { data: applications, error } = await query

  if (error) throw error

  const total = applications?.length || 0
  if (total === 0) {
    return []
  }

  // Count applications at each stage
  const submitted = applications?.filter(app =>
    ['submitted', 'in_review', 'interview', 'offer', 'rejected'].includes(app.status)
  ).length || 0
  const inReview = applications?.filter(app =>
    ['in_review', 'interview', 'offer', 'rejected'].includes(app.status)
  ).length || 0
  const interview = applications?.filter(app =>
    ['interview', 'offer', 'rejected'].includes(app.status)
  ).length || 0
  const offer = applications?.filter(app => app.status === 'offer').length || 0

  return [
    { stage: 'Draft', count: total, percentage: 100 },
    { stage: 'Submitted', count: submitted, percentage: Math.round((submitted / total) * 100) },
    { stage: 'In Review', count: inReview, percentage: Math.round((inReview / total) * 100) },
    { stage: 'Interview', count: interview, percentage: Math.round((interview / total) * 100) },
    { stage: 'Offer', count: offer, percentage: Math.round((offer / total) * 100) },
  ]
}

/**
 * Get applications breakdown by type
 */
export async function getApplicationsByType(
  timeRange: TimeRange = 'all',
  supabaseClient?: SupabaseClient
): Promise<TypeBreakdown[]> {
  const supabase = supabaseClient || createClient()
  const dateFilter = getDateFilter(timeRange)

  let query = supabase
    .from('applications')
    .select('type')

  if (dateFilter) {
    query = query.gte('created_at', dateFilter.toISOString())
  }

  const { data: applications, error } = await query

  if (error) throw error

  const total = applications?.length || 0
  if (total === 0) {
    return []
  }

  // Count by type
  const typeCounts = new Map<string, number>()
  applications?.forEach(app => {
    const type = app.type || 'other'
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1)
  })

  return Array.from(typeCounts.entries())
    .map(([type, count]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Get applications breakdown by priority
 */
export async function getApplicationsByPriority(
  timeRange: TimeRange = 'all',
  supabaseClient?: SupabaseClient
): Promise<PriorityBreakdown[]> {
  try {
    const supabase = supabaseClient || createClient()
    const dateFilter = getDateFilter(timeRange)

    let query = supabase
      .from('applications')
      .select('priority')

    if (dateFilter) {
      query = query.gte('created_at', dateFilter.toISOString())
    }

    const { data: applications, error } = await query

    if (error) {
      console.error('Supabase error in getApplicationsByPriority:', error)
      throw new Error(`Failed to fetch applications by priority: ${error.message}`)
    }

    const total = applications?.length || 0
    if (total === 0) {
      return []
    }

    // Count by priority
    const priorityCounts = new Map<string, number>()
    applications?.forEach(app => {
      const priority = app.priority || 'medium'
      priorityCounts.set(priority, (priorityCounts.get(priority) || 0) + 1)
    })

    // Order: high, medium, low
    const priorityOrder = ['high', 'medium', 'low']

    return priorityOrder
      .filter(priority => priorityCounts.has(priority))
      .map(priority => ({
        priority: priority.charAt(0).toUpperCase() + priority.slice(1),
        count: priorityCounts.get(priority) || 0,
        percentage: Math.round(((priorityCounts.get(priority) || 0) / total) * 100),
      }))
  } catch (err) {
    console.error('Error in getApplicationsByPriority:', err)
    throw err
  }
}
