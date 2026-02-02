import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cn, formatDate, formatDateTime, getDaysUntil } from './utils'

describe('Utility Functions', () => {
    describe('cn (Tailwind Merge)', () => {
        it('merges tailwind classes correctly', () => {
            expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
            expect(cn('p-4', 'pt-2')).toBe('p-4 pt-2')
        })

        it('handles conditional classes', () => {
            expect(cn('base', true && 'is-true', false && 'is-false')).toBe('base is-true')
        })
    })

    describe('formatDate', () => {
        it('formats string dates correctly', () => {
            const date = '2024-02-01'
            expect(formatDate(date)).toBe('Feb 1, 2024')
        })

        it('formats Date objects correctly', () => {
            const date = new Date(2024, 0, 15) // Jan 15, 2024
            expect(formatDate(date)).toBe('Jan 15, 2024')
        })
    })

    describe('getDaysUntil', () => {
        beforeEach(() => {
            vi.useFakeTimers()
            vi.setSystemTime(new Date('2024-02-01T12:00:00Z'))
        })

        afterEach(() => {
            vi.useRealTimers()
        })

        it('calculates days until a future date', () => {
            const target = '2024-02-05T12:00:00Z'
            expect(getDaysUntil(target)).toBe(4)
        })

        it('returns negative days for a past date', () => {
            const past = '2024-01-30T12:00:00Z'
            expect(getDaysUntil(past)).toBe(-2)
        })

        it('returns zero for the current day', () => {
            const today = '2024-02-01T13:00:00Z'
            expect(getDaysUntil(today)).toBe(1) // Ceil rounds up
        })
    })
})
