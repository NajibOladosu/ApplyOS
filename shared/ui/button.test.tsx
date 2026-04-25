import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Button } from './button'

describe('Button Component', () => {
    it('renders correctly with children', () => {
        render(<Button>Click me</Button>)
        expect(screen.getByText('Click me')).toBeInTheDocument()
    })

    it('handles click events', () => {
        const handleClick = vi.fn()
        render(<Button onClick={handleClick}>Click me</Button>)
        fireEvent.click(screen.getByText('Click me'))
        expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('is disabled when disabled prop is true', () => {
        render(<Button disabled>Click me</Button>)
        expect(screen.getByRole('button')).toBeDisabled()
    })

    it('applies variant classes correctly', () => {
        render(<Button variant="destructive">Delete</Button>)
        const button = screen.getByRole('button')
        expect(button).toHaveClass('bg-destructive')
    })
})
