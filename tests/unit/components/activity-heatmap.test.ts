import { describe, expect, it } from 'vitest'
import { responsiveWeekCount } from '@/components/data/activity-heatmap'

describe('responsive activity heatmap sizing', () => {
  it('adds enough week columns to fill a desktop activity card', () => {
    expect(responsiveWeekCount(766, 26)).toBe(46)
  })

  it('keeps the requested history when the card is narrow', () => {
    expect(responsiveWeekCount(400, 26)).toBe(26)
  })

  it('caps the graph at one year on very wide screens', () => {
    expect(responsiveWeekCount(1200, 26)).toBe(52)
  })
})
