export type UrgencyTier = 'overdue' | 'critical' | 'soon' | 'later' | 'none'

export function daysUntilDeadline(
  deadline: string | null | undefined,
): number | null {
  if (!deadline) return null
  const target = new Date(deadline)
  if (Number.isNaN(target.getTime())) return null

  const targetStart = new Date(target)
  targetStart.setHours(0, 0, 0, 0)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const ms = targetStart.getTime() - todayStart.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

export function urgencyTier(daysUntil: number | null): UrgencyTier {
  if (daysUntil === null) return 'none'
  if (daysUntil < 0) return 'overdue'
  if (daysUntil <= 2) return 'critical'
  if (daysUntil <= 7) return 'soon'
  return 'later'
}

export function urgencyLabel(daysUntil: number | null): string {
  if (daysUntil === null) return 'No deadline'
  if (daysUntil < 0) return `Overdue by ${Math.abs(daysUntil)}d`
  if (daysUntil === 0) return 'Due today'
  if (daysUntil === 1) return 'Due tomorrow'
  return `${daysUntil}d left`
}
