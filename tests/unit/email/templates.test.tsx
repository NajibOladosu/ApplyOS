import { describe, expect, it } from 'vitest'
import { render, toPlainText } from '@react-email/render'
import { ResetPasswordTemplate } from '@/emails/reset-password'
import { VerifyEmailTemplate } from '@/emails/verify-email'

describe('ResetPasswordTemplate', () => {
  it('renders user name and reset URL in HTML output', async () => {
    const html = await render(
      <ResetPasswordTemplate userName="Alice" resetUrl="https://x.com/reset?t=abc" />
    )
    expect(html).toContain('Alice')
    expect(html).toContain('https://x.com/reset?t=abc')
  })

  it('plain-text version contains essentials', async () => {
    const element = <ResetPasswordTemplate userName="Bob" resetUrl="https://x.com/r" />
    const html = await render(element)
    const text = await toPlainText(html)
    expect(text).toContain('Bob')
    expect(text).toContain('https://x.com/r')
  })
})

describe('VerifyEmailTemplate', () => {
  it('renders user name and verification URL in HTML output', async () => {
    const html = await render(
      <VerifyEmailTemplate userName="Charlie" verificationUrl="https://x.com/verify?t=xyz" />
    )
    expect(html).toContain('Charlie')
    expect(html).toContain('https://x.com/verify?t=xyz')
  })

  it('plain-text version contains essentials', async () => {
    const element = <VerifyEmailTemplate userName="Dana" verificationUrl="https://x.com/v" />
    const html = await render(element)
    const text = await toPlainText(html)
    expect(text).toContain('Dana')
    expect(text).toContain('https://x.com/v')
  })
})
