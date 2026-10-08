import { describe, expect, it } from 'vitest'
import { isEmailCategoryEnabled } from '@/shared/infrastructure/email/preferences'

describe('isEmailCategoryEnabled', () => {
  it('treats missing metadata and missing flags as enabled (settings defaults)', () => {
    expect(isEmailCategoryEnabled(undefined, 'deadline_reminders')).toBe(true)
    expect(isEmailCategoryEnabled(null, 'weekly_digest')).toBe(true)
    expect(isEmailCategoryEnabled({}, 'status_updates')).toBe(true)
  })

  it('honours a category-specific opt-out', () => {
    expect(isEmailCategoryEnabled({ deadline_reminders: false }, 'deadline_reminders')).toBe(false)
    expect(isEmailCategoryEnabled({ status_updates: false }, 'status_updates')).toBe(false)
    // Unsubscribing from the weekly digest must not be ignored (regression: the
    // unsubscribe endpoint wrote this flag but the digest cron never read it).
    expect(isEmailCategoryEnabled({ weekly_digest: false }, 'weekly_digest')).toBe(false)
  })

  it('does not let one category opt-out affect another category', () => {
    expect(isEmailCategoryEnabled({ deadline_reminders: false }, 'weekly_digest')).toBe(true)
    expect(isEmailCategoryEnabled({ weekly_digest: false }, 'deadline_reminders')).toBe(true)
  })

  it('global email_notifications=false disables every optional category', () => {
    const meta = { email_notifications: false }
    expect(isEmailCategoryEnabled(meta, 'deadline_reminders')).toBe(false)
    expect(isEmailCategoryEnabled(meta, 'status_updates')).toBe(false)
    expect(isEmailCategoryEnabled(meta, 'weekly_digest')).toBe(false)
  })

  it('fails closed on string "false" written by a client or import', () => {
    expect(isEmailCategoryEnabled({ weekly_digest: 'false' }, 'weekly_digest')).toBe(false)
    expect(isEmailCategoryEnabled({ deadline_reminders: ' FALSE ' }, 'deadline_reminders')).toBe(false)
    expect(isEmailCategoryEnabled({ email_notifications: 'false' }, 'status_updates')).toBe(false)
  })

  it('does not treat null, 0 or other non-false values as an opt-out', () => {
    expect(isEmailCategoryEnabled({ weekly_digest: null }, 'weekly_digest')).toBe(true)
    expect(isEmailCategoryEnabled({ email_notifications: 0 }, 'weekly_digest')).toBe(true)
    expect(isEmailCategoryEnabled({ weekly_digest: true }, 'weekly_digest')).toBe(true)
  })
})
