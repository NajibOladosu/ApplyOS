import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { subDays, startOfDay, format } from 'date-fns'
import type { ApplicationStatus } from '@/types/database'

export type TimeRange = '7d' | '30d' | '90d' | 'all'

interface ApplicationMetrics {
  total: number
  successRate: number
  averageTimeToOutcome: number | null
  interviewConversionRate: number
}

interface StatusFlowData {
  nodes: Array<{ name: string }>
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
  const supabase = supabaseClient || createClient()
  const dateFilter = getDateFilter(timeRange)

  let query = supabase
    .from('applications')
    .select('status, created_at, updated_at')

  if (dateFilter) {
    query = query.gte('created_at', dateFilter.toISOString())
  }

  const { data: applications, error } = await query

  if (error) throw error

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

  return {
    total,
    successRate: Math.round(successRate * 10) / 10,
    averageTimeToOutcome,
    interviewConversionRate: Math.round(interviewConversionRate * 10) / 10,
  }
}

/**
 * Get status flow data for Sankey diagram
 */
export async function getStatusFlowData(
  timeRange: TimeRange = 'all',
  supabaseClient?: SupabaseClient
): Promise<StatusFlowData> {
  const supabase = supabaseClient || createClient()
  const dateFilter = getDateFilter(timeRange)

  // Get all applications with their current status
  let appsQuery = supabase
    .from('applications')
    .select('id, status, created_at')
    .order('created_at', { ascending: true })

  if (dateFilter) {
    appsQuery = appsQuery.gte('created_at', dateFilter.toISOString())
  }

  const { data: applications, error: appsError } = await appsQuery

  if (appsError) throw appsError

  if (!applications || applications.length === 0) {
    return { nodes: [], links: [] }
  }

  // Get status history for all applications
  const appIds = applications.map(app => app.id)
  const { data: allHistory, error: historyError } = await supabase
    .from('status_history')
    .select('application_id, old_status, new_status, timestamp')
    .in('application_id', appIds)
    .order('timestamp', { ascending: true })

  if (historyError) throw historyError

  // Define the flow stages in order
  const stages: ApplicationStatus[] = ['draft', 'submitted', 'in_review', 'interview', 'offer', 'rejected']

  // Create nodes
  const nodes = stages.map(stage => ({
    name: stage.charAt(0).toUpperCase() + stage.slice(1).replace('_', ' ')
  }))

  // Build each application's complete journey
  const appJourneys = new Map<string, ApplicationStatus[]>()

  applications.forEach(app => {
    const history = allHistory?.filter(h => h.application_id === app.id) || []
    const journey: ApplicationStatus[] = []

    if (history.length === 0) {
      // No history means the app is still in its initial status
      journey.push(app.status as ApplicationStatus)
    } else {
      // Start from the first old_status (or draft if null)
      const firstOldStatus = history[0].old_status || 'draft'
      journey.push(firstOldStatus as ApplicationStatus)

      // Add all transitions (only forward ones)
      history.forEach(transition => {
        const newStatus = transition.new_status as ApplicationStatus
        const lastStatus = journey[journey.length - 1]
        const lastIndex = stages.indexOf(lastStatus)
        const newIndex = stages.indexOf(newStatus)

        // Only add forward transitions
        if (newIndex > lastIndex) {
          journey.push(newStatus)
        }
      })

      // Make sure the journey ends at the current status
      const currentStatus = app.status as ApplicationStatus
      const lastStatus = journey[journey.length - 1]
      if (lastStatus !== currentStatus) {
        const lastIndex = stages.indexOf(lastStatus)
        const currentIndex = stages.indexOf(currentStatus)
        if (currentIndex > lastIndex) {
          journey.push(currentStatus)
        }
      }
    }

    appJourneys.set(app.id, journey)
  })

  // Count flows between consecutive statuses
  const flowCounts = new Map<string, number>()

  appJourneys.forEach(journey => {
    for (let i = 0; i < journey.length - 1; i++) {
      const from = journey[i]
      const to = journey[i + 1]
      const key = `${from}->${to}`
      flowCounts.set(key, (flowCounts.get(key) || 0) + 1)
    }
  })

  // Create links
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
    }
  })

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
  if (!applications || applications.length === 0) {
    return []
  }

  // Group by date based on granularity
  const dateCounts = new Map<string, number>()

  applications.forEach(app => {
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
  const supabase = supabaseClient || createClient()
  const dateFilter = getDateFilter(timeRange)

  let query = supabase
    .from('applications')
    .select('priority')

  if (dateFilter) {
    query = query.gte('created_at', dateFilter.toISOString())
  }

  const { data: applications, error } = await query

  if (error) throw error

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
}
