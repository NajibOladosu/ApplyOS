import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Badge } from './badge'

describe('Badge Component', () => {
    it('renders children correctly', () => {
        render(<Badge>New</Badge>)
        expect(screen.getByText('New')).toBeInTheDocument()
    })

    it('applies variant classes', () => {
        const { container } = render(<Badge variant="outline">Outline</Badge>)
        expect(container.firstChild).toHaveClass('text-foreground')
    })
})
