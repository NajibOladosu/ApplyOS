import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from '@/components/theme-toggle'

const setTheme = vi.fn()
let currentTheme = 'dark'

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: currentTheme, setTheme }),
}))

beforeEach(() => {
  setTheme.mockClear()
  currentTheme = 'dark'
})

describe('ThemeToggle', () => {
  it('renders a button', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('shows current theme in aria-label after mount', async () => {
    render(<ThemeToggle />)
    // After useEffect runs, button label includes the theme
    const button = await screen.findByLabelText(/Current theme: dark/)
    expect(button).toBeInTheDocument()
  })

  it('cycles dark → system on click', async () => {
    currentTheme = 'dark'
    render(<ThemeToggle />)
    const button = await screen.findByLabelText(/Current theme: dark/)
    const user = userEvent.setup()
    await user.click(button)
    expect(setTheme).toHaveBeenCalledWith('system')
  })

  it('cycles light → dark on click', async () => {
    currentTheme = 'light'
    render(<ThemeToggle />)
    const button = await screen.findByLabelText(/Current theme: light/)
    const user = userEvent.setup()
    await user.click(button)
    expect(setTheme).toHaveBeenCalledWith('dark')
  })

  it('cycles system → light on click', async () => {
    currentTheme = 'system'
    render(<ThemeToggle />)
    const button = await screen.findByLabelText(/Current theme: system/)
    const user = userEvent.setup()
    await user.click(button)
    expect(setTheme).toHaveBeenCalledWith('light')
  })
})
