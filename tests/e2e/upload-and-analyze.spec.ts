import { test, expect } from '@playwright/test'
import path from 'path'
import { createTestUser, deleteTestUser, loginAs, TestUser } from './helpers/auth'

const SAMPLE_PDF = path.join(process.cwd(), 'tests', 'fixtures', 'pdfs', 'sample-cv.pdf')

let user: TestUser

test.beforeEach(async () => {
  user = await createTestUser()
})

test.afterEach(async () => {
  try { await deleteTestUser(user) } catch {}
})

test('upload page renders', async ({ context, page }) => {
  await loginAs(context, user)
  await page.goto('/upload')
  await expect(page).toHaveURL(/\/upload/)
  await expect(page.locator('body')).toBeVisible()
})

test('upload page accepts a PDF file', async ({ context, page }) => {
  await loginAs(context, user)
  await page.goto('/upload')
  await expect(page).toHaveURL(/\/upload/)

  const fileInput = page.locator('input[type="file"]').first()
  // Some upload UIs have hidden inputs; setInputFiles works regardless of visibility
  await fileInput.setInputFiles(SAMPLE_PDF)

  // Wait for filename to appear OR for any post-upload UI change
  const filename = page.locator('text=/sample-cv\\.pdf/i').first()
  await expect(filename).toBeVisible({ timeout: 15_000 })
})

test('documents page renders for signed-in user', async ({ context, page }) => {
  await loginAs(context, user)
  await page.goto('/documents')
  await expect(page).toHaveURL(/\/documents/)
  await expect(page.locator('body')).toBeVisible()
})
