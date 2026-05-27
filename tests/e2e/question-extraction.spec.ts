import { test, expect } from '@playwright/test'
import { createTestUser, deleteTestUser, loginAs, TestUser } from './helpers/auth'

let user: TestUser

test.beforeEach(async () => {
  user = await createTestUser()
})

test.afterEach(async () => {
  try { await deleteTestUser(user) } catch {}
})

test('notifications page renders for signed-in user', async ({ context, page }) => {
  await loginAs(context, user)
  await page.goto('/notifications')
  await expect(page).toHaveURL(/\/notifications/)
  await expect(page.locator('body')).toBeVisible()
})

test('profile page renders for signed-in user', async ({ context, page }) => {
  await loginAs(context, user)
  await page.goto('/profile')
  await expect(page).toHaveURL(/\/profile/)
  await expect(page.locator('body')).toBeVisible()
})

test('blog index renders for unauthenticated visitor', async ({ page }) => {
  await page.goto('/blog')
  await expect(page).toHaveURL(/\/blog/)
  await expect(page.locator('body')).toBeVisible()
})

test('public homepage renders', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/^http:\/\/localhost:3100\/?$/)
  await expect(page.locator('body')).toBeVisible()
})
