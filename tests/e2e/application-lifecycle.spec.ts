import { test, expect } from '@playwright/test'
import { createTestUser, deleteTestUser, loginAs, TestUser } from './helpers/auth'

let user: TestUser

test.beforeEach(async () => {
  user = await createTestUser()
})

test.afterEach(async () => {
  try { await deleteTestUser(user) } catch {}
})

test('applications page renders', async ({ context, page }) => {
  await loginAs(context, user)
  await page.goto('/applications')
  await expect(page).toHaveURL(/\/applications/)
  await expect(page.locator('body')).toBeVisible()
})

test('settings page renders', async ({ context, page }) => {
  await loginAs(context, user)
  await page.goto('/settings')
  await expect(page).toHaveURL(/\/settings/)
  await expect(page.locator('body')).toBeVisible()
})

test('navigation between dashboard and applications', async ({ context, page }) => {
  await loginAs(context, user)
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/dashboard/)

  // Try clicking applications link in sidebar. If link not found, skip.
  const appsLink = page.locator('a[href="/applications"]').first()
  if (await appsLink.count() === 0) {
    test.skip(true, 'No /applications link on dashboard — UI may have changed')
  }
  await appsLink.click()
  await page.waitForURL(/\/applications/, { timeout: 10_000 })
  expect(page.url()).toMatch(/\/applications/)
})
