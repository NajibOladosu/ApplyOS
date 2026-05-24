import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { daysUntilDeadline, urgencyTier, urgencyLabel } from './deadline'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-05-24T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('daysUntilDeadline', () => {
  it('returns null for null/undefined input', () => {
    expect(daysUntilDeadline(null)).toBeNull()
    expect(daysUntilDeadline(undefined)).toBeNull()
    expect(daysUntilDeadline('')).toBeNull()
  })

  it('returns null for invalid date string', () => {
    expect(daysUntilDeadline('not-a-date')).toBeNull()
  })

  it('returns 0 for today (mid-day)', () => {
    expect(daysUntilDeadline('2026-05-24T15:00:00Z')).toBe(0)
  })

  it('returns positive for future deadline', () => {
    expect(daysUntilDeadline('2026-05-27T12:00:00Z')).toBe(3)
  })

  it('returns negative for past deadline', () => {
    expect(daysUntilDeadline('2026-05-22T12:00:00Z')).toBe(-2)
  })

  it('handles single-day differences correctly', () => {
    expect(daysUntilDeadline('2026-05-25T00:00:00Z')).toBe(1)
    expect(daysUntilDeadline('2026-05-23T00:00:00Z')).toBe(-1)
  })
})

describe('urgencyTier', () => {
  it('returns none for null input', () => {
    expect(urgencyTier(null)).toBe('none')
  })

  it('returns overdue for negative days', () => {
    expect(urgencyTier(-1)).toBe('overdue')
    expect(urgencyTier(-100)).toBe('overdue')
  })

  it('returns critical for 0-2 days', () => {
    expect(urgencyTier(0)).toBe('critical')
    expect(urgencyTier(1)).toBe('critical')
    expect(urgencyTier(2)).toBe('critical')
  })

  it('returns soon for 3-7 days', () => {
    expect(urgencyTier(3)).toBe('soon')
    expect(urgencyTier(7)).toBe('soon')
  })

  it('returns later for > 7 days', () => {
    expect(urgencyTier(8)).toBe('later')
    expect(urgencyTier(30)).toBe('later')
  })
})

describe('urgencyLabel', () => {
  it('returns No deadline for null', () => {
    expect(urgencyLabel(null)).toBe('No deadline')
  })

  it('returns Overdue by Nd for negative days', () => {
    expect(urgencyLabel(-1)).toBe('Overdue by 1d')
    expect(urgencyLabel(-5)).toBe('Overdue by 5d')
  })

  it('returns Due today for 0', () => {
    expect(urgencyLabel(0)).toBe('Due today')
  })

  it('returns Due tomorrow for 1', () => {
    expect(urgencyLabel(1)).toBe('Due tomorrow')
  })

  it('returns Nd left for ≥ 2', () => {
    expect(urgencyLabel(2)).toBe('2d left')
    expect(urgencyLabel(10)).toBe('10d left')
  })
})
